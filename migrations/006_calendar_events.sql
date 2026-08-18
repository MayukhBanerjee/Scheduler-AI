-- ============================================================
-- 006_calendar_events.sql
-- ScheduleAI — Calendar Events
-- Author: Mayukh Banerjee
-- ============================================================
-- Creates:
--   calendar_events   — unified event storage for user and provider calendars
--                        Covers: AI-managed, Google Calendar synced, manual events
--   booking_conflicts — detected scheduling conflicts between bookings
-- ============================================================

-- ── calendar_event_type Enum ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE calendar_event_type AS ENUM (
    'booking',        -- auto-created from a confirmed booking
    'ai_managed',     -- AI-suggested/rescheduled event
    'google_synced',  -- imported from Google Calendar
    'manual'          -- manually created by user/provider
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── calendar_events ───────────────────────────────────────────────────────────
-- Unified calendar event table for both users and providers.
-- user_id: set for customer events
-- provider_id: set for provider-side events (their own calendar)
-- Both can be set simultaneously (provider sees their booking, user sees theirs).
CREATE TABLE IF NOT EXISTS calendar_events (
  id                UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID                 REFERENCES users(id) ON DELETE CASCADE,
  provider_id       UUID                 REFERENCES provider_profiles(id) ON DELETE CASCADE,
  booking_id        UUID                 REFERENCES bookings(id) ON DELETE CASCADE,

  -- Event content
  title             TEXT                 NOT NULL,
  description       TEXT                 DEFAULT '',
  location          TEXT                 DEFAULT '',
  start_at          TIMESTAMPTZ          NOT NULL,
  end_at            TIMESTAMPTZ          NOT NULL,

  -- Classification
  event_type        calendar_event_type  NOT NULL DEFAULT 'manual',
  source            TEXT                 DEFAULT '',    -- e.g. 'google', 'scheduleai', 'manual'

  -- Google Calendar integration (future)
  google_event_id   TEXT,                              -- Google Calendar event ID for sync
  google_calendar_id TEXT,                             -- Calendar ID within Google
  is_synced         BOOLEAN              NOT NULL DEFAULT FALSE,
  last_synced_at    TIMESTAMPTZ,

  -- Display
  color_hex         TEXT                 DEFAULT '#6366F1',
  is_all_day        BOOLEAN              NOT NULL DEFAULT FALSE,

  -- Conflict tracking
  has_conflict      BOOLEAN              NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

  -- At least one of user_id or provider_id must be set
  CONSTRAINT event_owner_check CHECK (
    user_id IS NOT NULL OR provider_id IS NOT NULL
  ),
  -- End must be after start
  CONSTRAINT event_time_check CHECK (end_at > start_at)
);

DO $$ BEGIN
  CREATE TRIGGER calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── booking_conflicts ─────────────────────────────────────────────────────────
-- Tracks detected scheduling conflicts between bookings.
-- Populated when the DB EXCLUDE constraint would fire, or when
-- the AI agent detects overlapping intent.
CREATE TABLE IF NOT EXISTS booking_conflicts (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_a_id    UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  booking_b_id    UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  conflict_type   TEXT        NOT NULL DEFAULT 'overlap',  -- 'overlap' | 'double_book' | 'ai_detected'
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,

  -- Ensure pair is not duplicated (A,B == B,A)
  CONSTRAINT conflicts_unique_pair CHECK (booking_a_id < booking_b_id),
  UNIQUE (booking_a_id, booking_b_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id     ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_provider_id ON calendar_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_booking_id  ON calendar_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at    ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_at      ON calendar_events(end_at);
-- Range query: user's events this week
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_range
  ON calendar_events(user_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_provider_range
  ON calendar_events(provider_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id
  ON calendar_events(google_event_id) WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conflicts_booking_a         ON booking_conflicts(booking_a_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_booking_b         ON booking_conflicts(booking_b_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved
  ON booking_conflicts(detected_at) WHERE resolved_at IS NULL;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE calendar_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_conflicts  ENABLE ROW LEVEL SECURITY;

-- Users see their own calendar events only
DROP POLICY IF EXISTS "calendar_events_user_read" ON calendar_events;
CREATE POLICY "calendar_events_user_read" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

-- Providers see their own calendar events only
DROP POLICY IF EXISTS "calendar_events_provider_read" ON calendar_events;
CREATE POLICY "calendar_events_provider_read" ON calendar_events
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Users and providers can manage their own events
DROP POLICY IF EXISTS "calendar_events_user_manage" ON calendar_events;
CREATE POLICY "calendar_events_user_manage" ON calendar_events
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_events_provider_manage" ON calendar_events;
CREATE POLICY "calendar_events_provider_manage" ON calendar_events
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Conflicts: visible to both parties
DROP POLICY IF EXISTS "conflicts_read_parties" ON booking_conflicts;
CREATE POLICY "conflicts_read_parties" ON booking_conflicts
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM bookings WHERE id = booking_a_id) OR
    auth.uid() = (SELECT user_id FROM bookings WHERE id = booking_b_id) OR
    auth.uid() = (SELECT user_id FROM provider_profiles pp JOIN bookings b ON b.provider_id = pp.id WHERE b.id = booking_a_id LIMIT 1)
  );

-- ── Trigger: auto-create calendar events from confirmed bookings ───────────────
-- When a booking is confirmed, auto-insert a calendar_events row for both
-- the user and the provider.
CREATE OR REPLACE FUNCTION create_calendar_event_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_user_id UUID;
  v_start_at TIMESTAMPTZ;
  v_end_at   TIMESTAMPTZ;
BEGIN
  -- Only fire on INSERT of confirmed bookings or UPDATE to confirmed
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND OLD.status != 'confirmed') THEN

    -- Get provider's user_id
    SELECT user_id INTO v_provider_user_id
    FROM provider_profiles WHERE id = NEW.provider_id;

    v_start_at := (NEW.date + NEW.start_time)::TIMESTAMPTZ AT TIME ZONE 'UTC';
    v_end_at   := v_start_at + (NEW.duration_minutes * INTERVAL '1 minute');

    -- User-side calendar event
    INSERT INTO calendar_events (user_id, booking_id, title, location, start_at, end_at, event_type, source)
    VALUES (NEW.user_id, NEW.id, NEW.service_name || ' @ ' || NEW.provider_name,
            NEW.location, v_start_at, v_end_at, 'booking', 'scheduleai')
    ON CONFLICT DO NOTHING;

    -- Provider-side calendar event
    INSERT INTO calendar_events (provider_id, booking_id, title, location, start_at, end_at, event_type, source)
    VALUES (NEW.provider_id, NEW.id, NEW.service_name || ' — ' || NEW.user_name,
            NEW.location, v_start_at, v_end_at, 'booking', 'scheduleai')
    ON CONFLICT DO NOTHING;

  -- On cancellation, mark events as cancelled by deleting them or updating
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    DELETE FROM calendar_events WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER booking_to_calendar_event
    AFTER INSERT OR UPDATE OF status ON bookings
    FOR EACH ROW EXECUTE FUNCTION create_calendar_event_from_booking();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
