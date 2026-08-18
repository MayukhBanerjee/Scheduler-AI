-- ============================================================
-- 013_fix_rls_policies.sql
-- ScheduleAI — Supabase RLS Fix for Custom Server JWT Auth
-- Author: Mayukh Banerjee
-- ============================================================

-- 1. Users Table
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert_public" ON users;
DROP POLICY IF EXISTS "users_select_public" ON users;
DROP POLICY IF EXISTS "users_update_public" ON users;

CREATE POLICY "users_insert_public" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_select_public" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_public" ON users FOR UPDATE USING (true);

-- 2. Provider Profiles
DROP POLICY IF EXISTS "provider_profiles_public_read" ON provider_profiles;
DROP POLICY IF EXISTS "provider_profiles_update_own" ON provider_profiles;
DROP POLICY IF EXISTS "provider_profiles_all_public" ON provider_profiles;

CREATE POLICY "provider_profiles_all_public" ON provider_profiles FOR ALL USING (true) WITH CHECK (true);

-- 3. Services & Tags
DROP POLICY IF EXISTS "services_public_read" ON services;
DROP POLICY IF EXISTS "services_manage_own" ON services;
DROP POLICY IF EXISTS "services_all_public" ON services;
CREATE POLICY "services_all_public" ON services FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_tags_public_read" ON service_tags;
DROP POLICY IF EXISTS "service_tags_manage_own" ON service_tags;
DROP POLICY IF EXISTS "service_tags_all_public" ON service_tags;
CREATE POLICY "service_tags_all_public" ON service_tags FOR ALL USING (true) WITH CHECK (true);

-- 4. Search Tags & Availability
DROP POLICY IF EXISTS "search_tags_public_read" ON provider_search_tags;
DROP POLICY IF EXISTS "search_tags_manage_own" ON provider_search_tags;
DROP POLICY IF EXISTS "provider_search_tags_all_public" ON provider_search_tags;
CREATE POLICY "provider_search_tags_all_public" ON provider_search_tags FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "availability_public_read" ON availability_slots;
DROP POLICY IF EXISTS "availability_manage_own" ON availability_slots;
DROP POLICY IF EXISTS "availability_slots_all_public" ON availability_slots;
CREATE POLICY "availability_slots_all_public" ON availability_slots FOR ALL USING (true) WITH CHECK (true);

-- 5. Bookings & Calendar
DROP POLICY IF EXISTS "bookings_user_read_own" ON bookings;
DROP POLICY IF EXISTS "bookings_provider_read_own" ON bookings;
DROP POLICY IF EXISTS "bookings_user_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_update_participants" ON bookings;
DROP POLICY IF EXISTS "bookings_all_public" ON bookings;
CREATE POLICY "bookings_all_public" ON bookings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "calendar_events_user_read" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_provider_read" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_user_manage" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_provider_manage" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_all_public" ON calendar_events;
CREATE POLICY "calendar_events_all_public" ON calendar_events FOR ALL USING (true) WITH CHECK (true);

-- 6. AI Chat Sessions & Messages
DROP POLICY IF EXISTS "chat_sessions_own" ON ai_chat_sessions;
DROP POLICY IF EXISTS "chat_messages_own" ON ai_chat_messages;
DROP POLICY IF EXISTS "chat_sessions_all_public" ON ai_chat_sessions;
DROP POLICY IF EXISTS "chat_messages_all_public" ON ai_chat_messages;
CREATE POLICY "chat_sessions_all_public" ON ai_chat_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "chat_messages_all_public" ON ai_chat_messages FOR ALL USING (true) WITH CHECK (true);

-- 7. Reviews
DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
DROP POLICY IF EXISTS "reviews_reviewer_read_own" ON reviews;
DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
DROP POLICY IF EXISTS "reviews_all_public" ON reviews;
CREATE POLICY "reviews_all_public" ON reviews FOR ALL USING (true) WITH CHECK (true);