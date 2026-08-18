-- ============================================================
-- 007_ai_chat.sql
-- ScheduleAI — AI Chat Sessions & Messages
-- Author: Mayukh Banerjee
-- ============================================================
-- Creates:
--   ai_chat_sessions   — conversation contexts for the LangGraph agent
--   ai_chat_messages   — individual message turns per session
-- ============================================================
-- Architecture note:
--   The Python backend (agent.py) currently does NOT persist chat
--   history to DB — it receives the last 8 turns from the frontend.
--   These tables make persistence server-side, enabling:
--     - Cross-device conversation continuity
--     - Analytics on intent patterns
--     - Future fine-tuning of the Gemini model
-- ============================================================

-- ── message_role Enum ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── ai_chat_sessions ──────────────────────────────────────────────────────────
-- One session per conversation thread. Maps to the conversation_id
-- generated in the chat route: {userId}-{timestamp}
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The conversation_id passed between frontend and Python backend
  -- Format: "{userId}-{timestamp}" e.g. "abc123-1724000000000"
  conversation_id  TEXT        NOT NULL UNIQUE,

  -- Session metadata
  title            TEXT,                   -- auto-generated from first message
  total_messages   INTEGER     NOT NULL DEFAULT 0,
  last_intent      JSONB,                  -- last ExtractedIntent object from agent
  last_services    JSONB,                  -- last ranked ServiceResult[] returned

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ai_chat_messages ──────────────────────────────────────────────────────────
-- Individual message turns within a session.
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID         NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,

  role             message_role NOT NULL,          -- 'user' or 'assistant'
  content          TEXT         NOT NULL,

  -- Structured data attached to assistant messages
  intent           JSONB,                           -- ExtractedIntent if assistant message
  services         JSONB,                           -- ServiceResult[] if results were returned
  needs_clarification BOOLEAN   NOT NULL DEFAULT FALSE,

  -- Message ordering
  turn_index       INTEGER      NOT NULL,           -- 0-indexed turn number within session

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Trigger: update session on new message ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_chat_sessions
  SET
    total_messages = total_messages + 1,
    last_active_at = NOW(),
    last_intent    = CASE WHEN NEW.intent IS NOT NULL THEN NEW.intent ELSE last_intent END,
    last_services  = CASE WHEN NEW.services IS NOT NULL THEN NEW.services ELSE last_services END
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER ai_message_inserted
    AFTER INSERT ON ai_chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_session_on_message();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id       ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_conversation  ON ai_chat_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_active   ON ai_chat_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id    ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_turn_order    ON ai_chat_messages(session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_chat_messages_intent        ON ai_chat_messages USING GIN (intent)
  WHERE intent IS NOT NULL;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE ai_chat_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages  ENABLE ROW LEVEL SECURITY;

-- Users can only access their own chat sessions and messages
DROP POLICY IF EXISTS "chat_sessions_own" ON ai_chat_sessions;
CREATE POLICY "chat_sessions_own" ON ai_chat_sessions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_messages_own" ON ai_chat_messages;
CREATE POLICY "chat_messages_own" ON ai_chat_messages
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM ai_chat_sessions WHERE id = session_id)
  );
