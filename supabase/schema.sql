-- ==============================================================================
-- ScheduleAI Supabase PostgreSQL Schema
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'provider'
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Service Providers Table
CREATE TABLE IF NOT EXISTS service_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    location_lower TEXT NOT NULL,
    rating NUMERIC(2, 1) DEFAULT 5.0,
    review_count INT DEFAULT 0,
    search_tags TEXT[] DEFAULT '{}',
    services JSONB DEFAULT '[]'::jsonb,
    availability_hours JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning-fast matching and filtering
CREATE INDEX IF NOT EXISTS idx_providers_search_tags ON service_providers USING GIN (search_tags);
CREATE INDEX IF NOT EXISTS idx_providers_category ON service_providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_location_lower ON service_providers(location_lower text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_providers_rating ON service_providers(rating DESC);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES service_providers(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    booking_date DATE NOT NULL,
    slot_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'cancelled' | 'completed'
    total_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_provider_slot UNIQUE (provider_id, booking_date, slot_time)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
