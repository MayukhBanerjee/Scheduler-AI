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
