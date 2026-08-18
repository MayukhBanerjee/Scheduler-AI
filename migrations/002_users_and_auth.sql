-- ============================================================
-- 002_users_and_auth.sql
-- ScheduleAI — Users, RBAC Roles & Auth Sessions
-- Author: Mayukh Banerjee
-- ============================================================
-- Creates the core identity layer:
--   users           — unified user table for customers and providers
--   user_sessions   — server-side JWT session tracking + revocation
-- ============================================================

-- ── RBAC Role Enum ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'provider');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── users ─────────────────────────────────────────────────────────────────────
-- Unified identity table.
-- Both customers (role='user') and service providers (role='provider')
-- live here. RBAC enforcement happens at the API layer (JWT role field)
-- and at the RLS policy layer below.
CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  role             user_role   NOT NULL DEFAULT 'user',
  password_hash    TEXT        NOT NULL,       -- bcrypt, cost factor 12
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── user_sessions ─────────────────────────────────────────────────────────────
-- Tracks issued JWT tokens server-side for:
--   - Forced logout / revocation
--   - Session audit trail
--   - Multi-device session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,   -- SHA-256 hash of the raw JWT
  expires_at   TIMESTAMPTZ NOT NULL,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ                    -- NULL = active
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id   ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token     ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires   ON user_sessions(expires_at);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions  ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own row only
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Sessions: users can only see their own sessions
CREATE POLICY "sessions_select_own" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (server) can bypass all RLS for admin operations
-- Note: Supabase service_role key automatically bypasses RLS
