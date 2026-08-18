-- ============================================================
-- 005_bookings.sql
-- ScheduleAI — Bookings & Double-Booking Prevention
-- Author: Mayukh Banerjee
-- ============================================================
-- Creates:
--   bookings   — appointment records between users and providers
-- ============================================================
-- KEY DESIGN NOTE on double-booking prevention:
--   MongoDB approach: Unique partial index on (provider_id, date, time)
--                     WHERE status IN ['confirmed','pending','completed']
--                     + application-level conflict check
--
--   PostgreSQL approach: Same partial unique index +
--                        ALSO an EXCLUDE USING GIST on tsrange
--                        for true range-based conflict detection
--                        (catches duration overlaps, not just exact time matches)
-- ============================================================

CREATE TABLE IF NOT EXISTS bookings (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Participants
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_id      UUID          NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  service_id       UUID          REFERENCES services(id) ON DELETE SET NULL,

  -- Denormalized fields (mirrors MongoDB booking document exactly)
  -- Kept so the app can display booking info without joins (performance + resilience)
  user_email       TEXT          NOT NULL,
  user_name        TEXT          NOT NULL,
  provider_name    TEXT          NOT NULL,
  provider_email   TEXT          NOT NULL DEFAULT '',
  service_name     TEXT          NOT NULL,
  location         TEXT          DEFAULT '',
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Scheduling
  date             DATE          NOT NULL,          -- replaces MongoDB date TEXT "YYYY-MM-DD"
  start_time       TIME          NOT NULL,          -- replaces MongoDB time TEXT "HH:MM"
  duration_minutes INTEGER       NOT NULL DEFAULT 60,

  -- Computed end time for range-based conflict detection
  -- end_time = start_time + duration_minutes interval
  end_time         TIME GENERATED ALWAYS AS (
    start_time + (duration_minutes * INTERVAL '1 minute')
  ) STORED,

  -- Status
  status           booking_status NOT NULL DEFAULT 'confirmed',

  -- Metadata
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- ── Legacy compatibility ──────────────────────────────────────────────────
  -- The MongoDB booking.service_id was a string "{providerId}:{serviceIndex}"
  -- In Postgres it's a proper UUID FK. This field stores the original string
  -- for backwards compatibility during migration only.
  legacy_service_id TEXT
);

DO $$ BEGIN
  CREATE TRIGGER bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Partial Unique Index (mirrors MongoDB unique_active_provider_slot) ─────────
-- Prevents two confirmed/pending/completed bookings for the same provider
-- at the exact same date + start_time. Matches MongoDB's original constraint.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_provider_slot
  ON bookings(provider_id, date, start_time)
  WHERE status IN ('confirmed', 'pending', 'completed');

-- ── EXCLUDE Constraint (range-based double-booking prevention) ─────────────────
-- Prevents bookings that OVERLAP in time (not just exact match).
-- e.g. A 09:00-10:00 booking blocks 09:30 even if start_time differs.
-- Requires btree_gist extension (001_enable_extensions.sql).
DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING GIST (
      provider_id     WITH =,
      date            WITH =,
      tsrange(
        date + start_time,
        date + end_time,
        '[)'
      )               WITH &&
    )
    WHERE (status IN ('confirmed', 'pending', 'completed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_user_id       ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id   ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id    ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date          ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status        ON bookings(status);
-- Composite: fetching user's upcoming bookings (most common query)
CREATE INDEX IF NOT EXISTS idx_bookings_user_upcoming
  ON bookings(user_id, date, start_time)
  WHERE status != 'cancelled';
-- Composite: provider's calendar view
CREATE INDEX IF NOT EXISTS idx_bookings_provider_upcoming
  ON bookings(provider_id, date, start_time)
  WHERE status != 'cancelled';

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookings
DROP POLICY IF EXISTS "bookings_user_read_own" ON bookings;
CREATE POLICY "bookings_user_read_own" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Providers can see bookings for their services
DROP POLICY IF EXISTS "bookings_provider_read_own" ON bookings;
CREATE POLICY "bookings_provider_read_own" ON bookings
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Users can create bookings (INSERT) for themselves
DROP POLICY IF EXISTS "bookings_user_insert" ON bookings;
CREATE POLICY "bookings_user_insert" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users and providers can update status of their bookings
-- (cancel: user or provider; complete: provider only — enforced in app layer)
DROP POLICY IF EXISTS "bookings_update_participants" ON bookings;
CREATE POLICY "bookings_update_participants" ON bookings
  FOR UPDATE USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );
