-- ============================================================
-- ScheduleAI — Full Complete Schema (001 through 010)
-- Author: Mayukh Banerjee
-- Run this in Supabase SQL Editor for 1-click setup
-- ============================================================



-- >>> START migrations\001_enable_extensions.sql <<< --

-- ============================================================
-- 001_enable_extensions.sql
-- ScheduleAI — Supabase PostgreSQL Migration
-- Author: Mayukh Banerjee
-- ============================================================
-- Run this FIRST in the Supabase SQL Editor.
-- Enables all required PostgreSQL extensions.
-- ============================================================

-- UUID generation for all primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgvector: stores 1536-dim OpenAI/Gemini embeddings for semantic service search
-- Enables:  SELECT * FROM services ORDER BY embedding <=> $1 LIMIT 10;
CREATE EXTENSION IF NOT EXISTS vector;

-- btree_gist: required for the tsrange EXCLUDE constraint
-- that prevents double-booking a provider slot at DB level
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- pg_trgm: enables fast ILIKE full-text search on provider names, tags, locations
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- >>> END migrations\001_enable_extensions.sql <<< --



-- >>> START migrations\002_users_and_auth.sql <<< --

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


-- >>> END migrations\002_users_and_auth.sql <<< --



-- >>> START migrations\003_provider_profiles.sql <<< --

-- ============================================================
-- 003_provider_profiles.sql
-- ScheduleAI — Provider Profiles & Availability
-- Author: Mayukh Banerjee
-- ============================================================
-- Creates:
--   provider_profiles   — extended data for service providers
--   availability_slots  — weekly/date-specific time slots
--   provider_search_tags — flat search tag index (mirrors MongoDB search_tags)
-- ============================================================

-- ── provider_profiles ─────────────────────────────────────────────────────────
-- One row per provider user. Linked 1:1 to users via user_id.
-- Mirrors MongoDB service_providers collection fields.
CREATE TABLE IF NOT EXISTS provider_profiles (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Identity / Discovery
  business_name   TEXT        NOT NULL,         -- "The Style Studio"
  owner_name      TEXT,                          -- "Priya Sharma"
  category        TEXT        NOT NULL,          -- "Beauty & Hair", "Healthcare", etc.
  description     TEXT        DEFAULT '',

  -- Location
  location        TEXT        DEFAULT '',        -- "Koramangala, Bangalore"
  location_lower  TEXT        GENERATED ALWAYS AS (LOWER(location)) STORED,

  -- Metrics
  rating          NUMERIC(3,1) NOT NULL DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  total_reviews   INTEGER      NOT NULL DEFAULT 0,
  is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TRIGGER provider_profiles_updated_at
    BEFORE UPDATE ON provider_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── provider_search_tags ──────────────────────────────────────────────────────
-- Flat, deduplicated, lowercase tag array — mirrors MongoDB search_tags[] on the
-- service_providers root document. Enables O(log n) indexed $in-style queries
-- via GIN index. The AI agent's matching.py uses this for provider lookup.
CREATE TABLE IF NOT EXISTS provider_search_tags (
  id           UUID   PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id  UUID   NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  tag          TEXT   NOT NULL,
  UNIQUE (provider_id, tag)
);

-- ── availability_slots ────────────────────────────────────────────────────────
-- Stores provider availability.
-- Supports two modes mirroring the MongoDB availability{} map:
--   1. Recurring weekly: day_of_week = 'monday'..'sunday', specific_date = NULL
--   2. Date override:    day_of_week = NULL, specific_date = '2026-09-15'
--
-- The booking route's getSlotsForDate() logic:
--   1. Check specific_date slots first (date override wins)
--   2. Fall back to day_of_week recurring slots
CREATE TABLE IF NOT EXISTS availability_slots (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id   UUID        NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  day_of_week   TEXT        CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  specific_date DATE,                          -- date-key override (e.g. cancellations)
  start_time    TIME        NOT NULL,           -- e.g. 09:00
  is_booked     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A slot can be either recurring (day_of_week set) or date-specific (specific_date set), not both
  CONSTRAINT slot_type_check CHECK (
    (day_of_week IS NOT NULL AND specific_date IS NULL) OR
    (day_of_week IS NULL AND specific_date IS NOT NULL)
  )
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_provider_profiles_user_id     ON provider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_category    ON provider_profiles(category);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_rating      ON provider_profiles(rating DESC);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_location    ON provider_profiles(location_lower);

-- GIN index on tags for fast tag-in lookups (mirrors MongoDB multikey B-tree index)
CREATE INDEX IF NOT EXISTS idx_provider_search_tags_tag
  ON provider_search_tags USING GIN (tag gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_provider_search_tags_provider
  ON provider_search_tags(provider_id);

CREATE INDEX IF NOT EXISTS idx_availability_provider         ON availability_slots(provider_id);
CREATE INDEX IF NOT EXISTS idx_availability_day              ON availability_slots(day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_date             ON availability_slots(specific_date);
CREATE INDEX IF NOT EXISTS idx_availability_booked           ON availability_slots(is_booked) WHERE is_booked = FALSE;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE provider_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_search_tags  ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots    ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated) can READ provider profiles for discovery
CREATE POLICY "provider_profiles_public_read" ON provider_profiles
  FOR SELECT USING (TRUE);

-- Providers can only UPDATE their own profile
CREATE POLICY "provider_profiles_update_own" ON provider_profiles
  FOR UPDATE USING (
    auth.uid() = user_id
  );

-- Tags are readable by all (for AI agent searches)
CREATE POLICY "search_tags_public_read" ON provider_search_tags
  FOR SELECT USING (TRUE);

-- Providers can only modify their own tags
CREATE POLICY "search_tags_manage_own" ON provider_search_tags
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Availability: publicly readable for booking discovery
CREATE POLICY "availability_public_read" ON availability_slots
  FOR SELECT USING (TRUE);

-- Only the owning provider can create/update/delete their slots
CREATE POLICY "availability_manage_own" ON availability_slots
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );


-- >>> END migrations\003_provider_profiles.sql <<< --



-- >>> START migrations\004_services.sql <<< --

-- ============================================================
-- 004_services.sql
-- ScheduleAI — Services Catalog
-- Author: Mayukh Banerjee
-- ============================================================
-- Creates:
--   services       — individual services offered by providers
--   service_tags   — per-service tag lookup (for discovery & AI search)
-- ============================================================
-- Note on MongoDB → PostgreSQL difference:
--   MongoDB: Services were EMBEDDED in service_providers.services[]
--   PostgreSQL: Services get their own table with FK → provider_profiles
--   This allows proper joins, separate RLS, and pgvector embeddings.
-- ============================================================

-- ── booking_status Enum ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── services ──────────────────────────────────────────────────────────────────
-- Each row is a specific service offering from a provider.
-- Replaces MongoDB service_providers.services[] embedded array.
-- The stable service id format "{provider_id}:{index}" is preserved
-- via the legacy_id column for backwards compatibility with existing bookings.
CREATE TABLE IF NOT EXISTS services (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id      UUID          NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,

  -- Service details (mirrors EmbeddedService fields from seed_db.py)
  name             TEXT          NOT NULL,
  category         TEXT          NOT NULL,          -- inherited from provider, duplicated for query efficiency
  description      TEXT          DEFAULT '',
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER       NOT NULL DEFAULT 60,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,

  -- pgvector: 1536-dimension embedding for semantic similarity search
  -- Generated via OpenAI text-embedding-3-small or Gemini embedding-001
  -- AI agent query: SELECT * FROM services ORDER BY embedding <=> $query_vec LIMIT 10;
  embedding        VECTOR(1536),

  -- Backwards-compatibility with MongoDB's "{providerId}:{serviceIndex}" format
  -- Used to match existing booking.service_id string references
  legacy_id        TEXT          UNIQUE,

  -- Sort order (preserves original embedding order within a provider)
  sort_order       INTEGER       NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TRIGGER services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── service_tags ──────────────────────────────────────────────────────────────
-- Per-service tags (mirrors EmbeddedService.tags[]).
-- Also rolled up into provider_search_tags for AI agent provider lookup.
CREATE TABLE IF NOT EXISTS service_tags (
  id          UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id  UUID  NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  tag         TEXT  NOT NULL,
  UNIQUE (service_id, tag)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_services_provider        ON services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_category        ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_active       ON services(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_services_price           ON services(price);
CREATE INDEX IF NOT EXISTS idx_services_legacy_id       ON services(legacy_id);

-- IVFFlat vector index for fast approximate nearest-neighbor (ANN) semantic search
-- Recommended for tables with < 1M rows; use HNSW for larger datasets
CREATE INDEX IF NOT EXISTS idx_services_embedding
  ON services USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_service_tags_service     ON service_tags(service_id);
CREATE INDEX IF NOT EXISTS idx_service_tags_tag
  ON service_tags USING GIN (tag gin_trgm_ops);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_tags  ENABLE ROW LEVEL SECURITY;

-- Services are publicly readable (any authenticated user can browse)
CREATE POLICY "services_public_read" ON services
  FOR SELECT USING (TRUE);

-- Providers can only INSERT/UPDATE/DELETE their own services
CREATE POLICY "services_manage_own" ON services
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Service tags follow service ownership
CREATE POLICY "service_tags_public_read" ON service_tags
  FOR SELECT USING (TRUE);

CREATE POLICY "service_tags_manage_own" ON service_tags
  FOR ALL USING (
    auth.uid() = (
      SELECT pp.user_id FROM provider_profiles pp
      JOIN services s ON s.provider_id = pp.id
      WHERE s.id = service_id
    )
  );


-- >>> END migrations\004_services.sql <<< --



-- >>> START migrations\005_bookings.sql <<< --

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
CREATE POLICY "bookings_user_read_own" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Providers can see bookings for their services
CREATE POLICY "bookings_provider_read_own" ON bookings
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Users can create bookings (INSERT) for themselves
CREATE POLICY "bookings_user_insert" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users and providers can update status of their bookings
-- (cancel: user or provider; complete: provider only — enforced in app layer)
CREATE POLICY "bookings_update_participants" ON bookings
  FOR UPDATE USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );


-- >>> END migrations\005_bookings.sql <<< --



-- >>> START migrations\006_calendar_events.sql <<< --

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
CREATE POLICY "calendar_events_user_read" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

-- Providers see their own calendar events only
CREATE POLICY "calendar_events_provider_read" ON calendar_events
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Users and providers can manage their own events
CREATE POLICY "calendar_events_user_manage" ON calendar_events
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "calendar_events_provider_manage" ON calendar_events
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Conflicts: visible to both parties
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


-- >>> END migrations\006_calendar_events.sql <<< --



-- >>> START migrations\007_ai_chat.sql <<< --

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
-- generated in the chat route: `${session.userId}-${Date.now()}`
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
CREATE POLICY "chat_sessions_own" ON ai_chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "chat_messages_own" ON ai_chat_messages
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM ai_chat_sessions WHERE id = session_id)
  );


-- >>> END migrations\007_ai_chat.sql <<< --



-- >>> START migrations\008_reviews.sql <<< --

-- ============================================================
-- 008_reviews.sql
-- ScheduleAI — Reviews & Ratings
-- Author: Mayukh Banerjee
-- ============================================================
-- Creates:
--   reviews           — post-booking reviews from customers
-- ============================================================
-- Rating update strategy:
--   A trigger updates provider_profiles.rating and total_reviews
--   whenever a review is inserted or updated, keeping the aggregate
--   in sync without needing a separate analytics query each time.
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id       UUID        NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id      UUID        NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id       UUID        REFERENCES services(id) ON DELETE SET NULL,

  rating           SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT        DEFAULT '',

  -- Flags
  is_public        BOOLEAN     NOT NULL DEFAULT TRUE,
  is_flagged       BOOLEAN     NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TRIGGER reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Trigger: update provider average rating on review change ──────────────────
CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating   NUMERIC(3,1);
  review_count INTEGER;
BEGIN
  -- Recalculate from all public, non-flagged reviews for this provider
  SELECT
    ROUND(AVG(rating)::NUMERIC, 1),
    COUNT(*)
  INTO avg_rating, review_count
  FROM reviews
  WHERE provider_id = COALESCE(NEW.provider_id, OLD.provider_id)
    AND is_public = TRUE
    AND is_flagged = FALSE;

  UPDATE provider_profiles
  SET
    rating       = COALESCE(avg_rating, 5.0),
    total_reviews = review_count
  WHERE id = COALESCE(NEW.provider_id, OLD.provider_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER reviews_update_provider_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_provider_rating();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_provider_id    ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id    ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_service_id     ON reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating         ON reviews(rating);
-- Provider's visible reviews (most recent first)
CREATE INDEX IF NOT EXISTS idx_reviews_provider_public
  ON reviews(provider_id, created_at DESC)
  WHERE is_public = TRUE AND is_flagged = FALSE;

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read public, non-flagged reviews
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (is_public = TRUE AND is_flagged = FALSE);

-- Reviewers can see their own reviews regardless of flags
CREATE POLICY "reviews_reviewer_read_own" ON reviews
  FOR SELECT USING (auth.uid() = reviewer_id);

-- Only the reviewer can insert a review (and only for their own completed bookings)
CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.user_id = auth.uid()
        AND b.status = 'completed'
    )
  );

-- Reviewers can update their own reviews
CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE USING (auth.uid() = reviewer_id);


-- >>> END migrations\008_reviews.sql <<< --



-- >>> START migrations\009_indexes_and_views.sql <<< --

-- ============================================================
-- 009_indexes_and_views.sql
-- ScheduleAI — Performance Indexes & Convenience Views
-- Author: Mayukh Banerjee
-- ============================================================
-- Additional composite indexes for the most common query patterns
-- + useful SQL Views for the API layer
-- ============================================================

-- ── Additional composite indexes ──────────────────────────────────────────────

-- Provider search: category + location (most common agent query combination)
CREATE INDEX IF NOT EXISTS idx_provider_category_location
  ON provider_profiles(category, location_lower);

-- Provider search: category + rating (leaderboard / top providers)
CREATE INDEX IF NOT EXISTS idx_provider_category_rating
  ON provider_profiles(category, rating DESC);

-- Bookings: user's bookings by date range (calendar view)
CREATE INDEX IF NOT EXISTS idx_bookings_user_date_range
  ON bookings(user_id, date)
  WHERE status != 'cancelled';

-- Services: provider + active (for profile page listing)
CREATE INDEX IF NOT EXISTS idx_services_provider_active
  ON services(provider_id, sort_order)
  WHERE is_active = TRUE;

-- Full-text search on provider names and descriptions using trigrams
CREATE INDEX IF NOT EXISTS idx_provider_name_trgm
  ON provider_profiles USING GIN (business_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_provider_desc_trgm
  ON provider_profiles USING GIN (description gin_trgm_ops);

-- Full-text search on service names
CREATE INDEX IF NOT EXISTS idx_service_name_trgm
  ON services USING GIN (name gin_trgm_ops);

-- ── Views ─────────────────────────────────────────────────────────────────────

-- VIEW: provider_discovery
-- Used by the Discover tab and AI agent for provider lookup.
-- Joins provider_profiles + users + aggregated tags in one query.
CREATE OR REPLACE VIEW provider_discovery AS
SELECT
  pp.id                  AS provider_id,
  pp.user_id,
  u.email,
  pp.business_name       AS name,
  pp.owner_name,
  pp.category,
  pp.description,
  pp.location,
  pp.location_lower,
  pp.rating,
  pp.total_reviews,
  pp.is_verified,
  ARRAY_AGG(DISTINCT pst.tag ORDER BY pst.tag) FILTER (WHERE pst.tag IS NOT NULL) AS search_tags
FROM provider_profiles pp
JOIN users u ON u.id = pp.user_id
LEFT JOIN provider_search_tags pst ON pst.provider_id = pp.id
GROUP BY pp.id, pp.user_id, u.email, pp.business_name, pp.owner_name,
         pp.category, pp.description, pp.location, pp.location_lower,
         pp.rating, pp.total_reviews, pp.is_verified;

-- VIEW: service_catalog
-- Joins services + provider_profiles for the Discover page service cards.
CREATE OR REPLACE VIEW service_catalog AS
SELECT
  s.id                   AS service_id,
  s.legacy_id,
  s.provider_id,
  pp.business_name       AS provider_name,
  pp.location,
  pp.location_lower,
  pp.rating              AS provider_rating,
  pp.is_verified,
  pp.category,
  s.name                 AS service_name,
  s.description,
  s.price,
  s.duration_minutes,
  s.is_active,
  ARRAY_AGG(DISTINCT st.tag ORDER BY st.tag) FILTER (WHERE st.tag IS NOT NULL) AS tags
FROM services s
JOIN provider_profiles pp ON pp.id = s.provider_id
LEFT JOIN service_tags st ON st.service_id = s.id
WHERE s.is_active = TRUE
GROUP BY s.id, s.legacy_id, s.provider_id, pp.business_name, pp.location,
         pp.location_lower, pp.rating, pp.is_verified, pp.category,
         s.name, s.description, s.price, s.duration_minutes, s.is_active;

-- VIEW: user_booking_history
-- Pre-joined booking view for the Bookings tab.
CREATE OR REPLACE VIEW user_booking_history AS
SELECT
  b.id                   AS booking_id,
  b.user_id,
  b.provider_id,
  b.service_id,
  b.service_name,
  b.provider_name,
  b.location,
  b.price,
  b.date,
  b.start_time,
  b.duration_minutes,
  b.end_time,
  b.status,
  b.created_at,
  b.updated_at,
  pp.category,
  pp.is_verified,
  pp.rating              AS provider_rating,
  r.rating               AS user_rating,
  r.comment              AS user_review
FROM bookings b
JOIN provider_profiles pp ON pp.id = b.provider_id
LEFT JOIN reviews r ON r.booking_id = b.id AND r.reviewer_id = b.user_id;

-- VIEW: provider_booking_dashboard
-- Provider-side view of all their bookings for the provider dashboard.
CREATE OR REPLACE VIEW provider_booking_dashboard AS
SELECT
  b.id                   AS booking_id,
  b.provider_id,
  b.user_id,
  b.user_name,
  b.user_email,
  b.service_name,
  b.price,
  b.date,
  b.start_time,
  b.duration_minutes,
  b.end_time,
  b.status,
  b.created_at,
  b.location,
  r.rating               AS review_rating,
  r.comment              AS review_comment
FROM bookings b
LEFT JOIN reviews r ON r.booking_id = b.id;

-- VIEW: upcoming_calendar_events
-- User + Provider combined view for the Calendar tab.
CREATE OR REPLACE VIEW upcoming_calendar_events AS
SELECT
  ce.id,
  ce.user_id,
  ce.provider_id,
  ce.booking_id,
  ce.title,
  ce.description,
  ce.location,
  ce.start_at,
  ce.end_at,
  ce.event_type,
  ce.source,
  ce.color_hex,
  ce.has_conflict,
  ce.is_all_day,
  b.status               AS booking_status,
  b.service_name,
  b.provider_name,
  b.user_name
FROM calendar_events ce
LEFT JOIN bookings b ON b.id = ce.booking_id
WHERE ce.start_at >= NOW() - INTERVAL '1 day';  -- Show from yesterday onwards


-- >>> END migrations\009_indexes_and_views.sql <<< --



-- >>> START migrations\010_functions.sql <<< --

-- ============================================================
-- 010_functions.sql
-- ScheduleAI — PostgreSQL Helper Functions & RPCs
-- Author: Mayukh Banerjee
-- ============================================================
-- Callable via Supabase JS client: supabase.rpc('function_name', params)
-- All functions use SECURITY DEFINER where they need service-role access.
-- ============================================================

-- ── Function: get_available_slots ─────────────────────────────────────────────
-- Returns available time slots for a provider on a given date.
-- Mirrors the Node.js getSlotsForDate() logic in app/api/bookings/route.ts.
-- Logic:
--   1. Check for specific date override in availability_slots first
--   2. Fall back to the recurring weekday template
--   3. Exclude already-booked slots
CREATE OR REPLACE FUNCTION get_available_slots(
  p_provider_profile_id UUID,
  p_date                DATE
)
RETURNS TABLE(slot_time TIME, is_available BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_day_of_week TEXT;
  v_has_date_override BOOLEAN;
BEGIN
  v_day_of_week := LOWER(TO_CHAR(p_date, 'Day'));
  -- Trim whitespace from TO_CHAR output
  v_day_of_week := TRIM(v_day_of_week);

  -- Check if there is a date-specific override
  SELECT EXISTS(
    SELECT 1 FROM availability_slots
    WHERE provider_id = p_provider_profile_id
      AND specific_date = p_date
      AND is_booked = FALSE
  ) INTO v_has_date_override;

  IF v_has_date_override THEN
    -- Return date-specific slots (highest priority)
    RETURN QUERY
    SELECT
      av.start_time,
      NOT EXISTS (
        SELECT 1 FROM bookings bk
        WHERE bk.provider_id = p_provider_profile_id
          AND bk.date = p_date
          AND bk.start_time = av.start_time
          AND bk.status IN ('confirmed', 'pending', 'completed')
      ) AS is_available
    FROM availability_slots av
    WHERE av.provider_id = p_provider_profile_id
      AND av.specific_date = p_date
    ORDER BY av.start_time;
  ELSE
    -- Return recurring weekday slots
    RETURN QUERY
    SELECT
      av.start_time,
      NOT EXISTS (
        SELECT 1 FROM bookings bk
        WHERE bk.provider_id = p_provider_profile_id
          AND bk.date = p_date
          AND bk.start_time = av.start_time
          AND bk.status IN ('confirmed', 'pending', 'completed')
      ) AS is_available
    FROM availability_slots av
    WHERE av.provider_id = p_provider_profile_id
      AND av.day_of_week = v_day_of_week
    ORDER BY av.start_time;
  END IF;
END;
$$;

-- ── Function: search_providers_by_tags ────────────────────────────────────────
-- Replicates MongoDB find_providers_by_tags() for the AI agent.
-- Called by the Python backend after the Supabase migration.
-- Returns providers sorted by rating DESC, optionally filtered by category/location.
CREATE OR REPLACE FUNCTION search_providers_by_tags(
  p_tags          TEXT[],
  p_category      TEXT    DEFAULT NULL,
  p_location_like TEXT    DEFAULT NULL,   -- prefix match on location_lower
  p_provider_name TEXT    DEFAULT NULL,   -- case-insensitive ILIKE
  p_limit         INTEGER DEFAULT 30
)
RETURNS TABLE(
  provider_id   UUID,
  user_id       UUID,
  business_name TEXT,
  owner_name    TEXT,
  email         TEXT,
  category      TEXT,
  description   TEXT,
  location      TEXT,
  rating        NUMERIC,
  total_reviews INTEGER,
  is_verified   BOOLEAN,
  search_tags   TEXT[],
  tag_match_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH tag_matches AS (
    SELECT
      pp.id AS pid,
      COUNT(DISTINCT pst.tag) AS match_count
    FROM provider_profiles pp
    JOIN provider_search_tags pst ON pst.provider_id = pp.id
    WHERE pst.tag = ANY(p_tags)
    GROUP BY pp.id
  )
  SELECT
    pp.id,
    pp.user_id,
    pp.business_name,
    pp.owner_name,
    u.email,
    pp.category,
    pp.description,
    pp.location,
    pp.rating,
    pp.total_reviews,
    pp.is_verified,
    ARRAY_AGG(DISTINCT pst2.tag ORDER BY pst2.tag) AS search_tags,
    tm.match_count
  FROM provider_profiles pp
  JOIN users u ON u.id = pp.user_id
  JOIN tag_matches tm ON tm.pid = pp.id
  LEFT JOIN provider_search_tags pst2 ON pst2.provider_id = pp.id
  WHERE
    (p_category IS NULL OR pp.category = p_category)
    AND (p_location_like IS NULL OR pp.location_lower LIKE p_location_like || '%')
    AND (p_provider_name IS NULL OR pp.business_name ILIKE '%' || p_provider_name || '%')
  GROUP BY pp.id, pp.user_id, pp.business_name, pp.owner_name, u.email,
           pp.category, pp.description, pp.location, pp.rating,
           pp.total_reviews, pp.is_verified, tm.match_count
  ORDER BY pp.rating DESC, tm.match_count DESC
  LIMIT p_limit;
END;
$$;

-- ── Function: create_booking_safe ─────────────────────────────────────────────
-- Atomically creates a booking and removes the slot from availability.
-- Returns the new booking ID or raises an exception on conflict.
-- Mirrors the POST /api/bookings logic as a stored procedure for atomicity.
CREATE OR REPLACE FUNCTION create_booking_safe(
  p_user_id          UUID,
  p_provider_id      UUID,    -- provider_profiles.id
  p_service_id       UUID,    -- services.id
  p_date             DATE,
  p_start_time       TIME,
  p_service_name     TEXT,
  p_provider_name    TEXT,
  p_provider_email   TEXT,
  p_user_email       TEXT,
  p_user_name        TEXT,
  p_location         TEXT,
  p_price            NUMERIC,
  p_duration_minutes INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id UUID;
  v_conflict_count INT;
BEGIN
  -- 1. Check for conflicts
  SELECT COUNT(*) INTO v_conflict_count
  FROM bookings
  WHERE provider_id = p_provider_id
    AND date = p_date
    AND start_time = p_start_time
    AND status IN ('confirmed', 'pending', 'completed');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Insert the booking
  INSERT INTO bookings (
    user_id, provider_id, service_id,
    user_email, user_name,
    provider_name, provider_email,
    service_name, location, price,
    date, start_time, duration_minutes,
    status, legacy_service_id
  )
  VALUES (
    p_user_id, p_provider_id, p_service_id,
    p_user_email, p_user_name,
    p_provider_name, p_provider_email,
    p_service_name, p_location, p_price,
    p_date, p_start_time, p_duration_minutes,
    'confirmed',
    NULL
  )
  RETURNING id INTO v_booking_id;

  -- 3. Mark the slot as booked in availability_slots
  -- First try date-specific override, then recurring weekday
  UPDATE availability_slots
  SET is_booked = TRUE
  WHERE provider_id = p_provider_id
    AND start_time = p_start_time
    AND (
      specific_date = p_date OR
      day_of_week = TRIM(LOWER(TO_CHAR(p_date, 'Day')))
    )
    AND is_booked = FALSE;

  RETURN v_booking_id;
END;
$$;

-- ── Function: cancel_booking_safe ─────────────────────────────────────────────
-- Atomically cancels a booking and restores the slot.
CREATE OR REPLACE FUNCTION cancel_booking_safe(
  p_booking_id  UUID,
  p_actor_id    UUID    -- auth.uid() of the person cancelling
)
RETURNS booking_status
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking       bookings%ROWTYPE;
  v_provider_uid  UUID;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Authorization: actor must be the user OR the provider
  SELECT user_id INTO v_provider_uid
  FROM provider_profiles WHERE id = v_booking.provider_id;

  IF p_actor_id != v_booking.user_id AND p_actor_id != v_provider_uid THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0003';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RAISE EXCEPTION 'ALREADY_CANCELLED' USING ERRCODE = 'P0004';
  END IF;

  -- Update status
  UPDATE bookings SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_booking_id;

  -- Restore the slot in availability_slots
  UPDATE availability_slots
  SET is_booked = FALSE
  WHERE provider_id = v_booking.provider_id
    AND start_time = v_booking.start_time
    AND (
      specific_date = v_booking.date OR
      day_of_week = TRIM(LOWER(TO_CHAR(v_booking.date, 'Day')))
    );

  RETURN 'cancelled';
END;
$$;

-- ── Function: get_user_analytics ─────────────────────────────────────────────
-- Returns analytics data for the Analytics tab in the customer dashboard.
CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH stats AS (
    SELECT
      COUNT(*)                                               AS total_bookings,
      COUNT(*) FILTER (WHERE status = 'completed')          AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled')          AS cancelled,
      COUNT(*) FILTER (WHERE status = 'confirmed')          AS upcoming,
      SUM(price) FILTER (WHERE status = 'completed')        AS total_spent,
      -- Time saved estimate: each completed appointment saves ~30min of searching
      COUNT(*) FILTER (WHERE status = 'completed') * 30     AS minutes_saved,
      ROUND(
        CASE WHEN COUNT(*) > 0
          THEN (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100
          ELSE 0
        END, 1
      )                                                      AS completion_rate
    FROM bookings
    WHERE user_id = p_user_id
  ),
  by_category AS (
    SELECT
      pp.category,
      COUNT(*) AS booking_count,
      SUM(b.price) AS total_spent
    FROM bookings b
    JOIN provider_profiles pp ON pp.id = b.provider_id
    WHERE b.user_id = p_user_id AND b.status = 'completed'
    GROUP BY pp.category
    ORDER BY booking_count DESC
    LIMIT 5
  ),
  monthly AS (
    SELECT
      TO_CHAR(date, 'Mon') AS month,
      COUNT(*) AS bookings
    FROM bookings
    WHERE user_id = p_user_id
      AND date >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY TO_CHAR(date, 'Mon'), DATE_TRUNC('month', date)
    ORDER BY DATE_TRUNC('month', date)
  )
  SELECT JSON_BUILD_OBJECT(
    'total_bookings',   s.total_bookings,
    'completed',        s.completed,
    'cancelled',        s.cancelled,
    'upcoming',         s.upcoming,
    'total_spent',      COALESCE(s.total_spent, 0),
    'minutes_saved',    s.minutes_saved,
    'completion_rate',  s.completion_rate,
    'by_category',      (SELECT JSON_AGG(by_category) FROM by_category),
    'monthly_trend',    (SELECT JSON_AGG(monthly) FROM monthly)
  ) INTO v_result
  FROM stats s;

  RETURN v_result;
END;
$$;


-- >>> END migrations\010_functions.sql <<< --

