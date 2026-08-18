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
