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
DROP POLICY IF EXISTS "services_public_read" ON services;`r`nCREATE POLICY "services_public_read" ON services
  FOR SELECT USING (TRUE);

-- Providers can only INSERT/UPDATE/DELETE their own services
DROP POLICY IF EXISTS "services_manage_own" ON services;`r`nCREATE POLICY "services_manage_own" ON services
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM provider_profiles WHERE id = provider_id)
  );

-- Service tags follow service ownership
DROP POLICY IF EXISTS "service_tags_public_read" ON service_tags;`r`nCREATE POLICY "service_tags_public_read" ON service_tags
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "service_tags_manage_own" ON service_tags;`r`nCREATE POLICY "service_tags_manage_own" ON service_tags
  FOR ALL USING (
    auth.uid() = (
      SELECT pp.user_id FROM provider_profiles pp
      JOIN services s ON s.provider_id = pp.id
      WHERE s.id = service_id
    )
  );
