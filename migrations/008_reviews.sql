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
DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (is_public = TRUE AND is_flagged = FALSE);

-- Reviewers can see their own reviews regardless of flags
DROP POLICY IF EXISTS "reviews_reviewer_read_own" ON reviews;
CREATE POLICY "reviews_reviewer_read_own" ON reviews
  FOR SELECT USING (auth.uid() = reviewer_id);

-- Only the reviewer can insert a review (and only for their own completed bookings)
DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
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
DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE USING (auth.uid() = reviewer_id);
