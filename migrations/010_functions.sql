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
