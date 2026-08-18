# Supabase Client Setup Guide
**ScheduleAI — Supabase Integration**
*Author: Mayukh Banerjee*

---

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) → New Project
2. Name it `scheduleai`, pick a region closest to your users
3. Copy your credentials from **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role / secret key` → `SUPABASE_SERVICE_ROLE_KEY` (**never expose this to client**)

---

## Step 2: Run Migrations (in Order)

Open **Supabase Dashboard → SQL Editor** and run each file **in order**:

| Order | File | What it creates |
|-------|------|-----------------|
| 1 | `001_enable_extensions.sql` | pgvector, uuid-ossp, btree_gist, pg_trgm |
| 2 | `002_users_and_auth.sql` | users, user_sessions, RBAC enum |
| 3 | `003_provider_profiles.sql` | provider_profiles, availability_slots, search_tags |
| 4 | `004_services.sql` | services, service_tags, booking_status enum |
| 5 | `005_bookings.sql` | bookings, double-booking constraints |
| 6 | `006_calendar_events.sql` | calendar_events, booking_conflicts, auto-trigger |
| 7 | `007_ai_chat.sql` | ai_chat_sessions, ai_chat_messages |
| 8 | `008_reviews.sql` | reviews, auto-rating trigger |
| 9 | `009_indexes_and_views.sql` | Composite indexes + SQL views |
| 10 | `010_functions.sql` | RPC functions (booking, search, analytics) |
| 11 | `011_seed_data.sql` | Demo data (4 providers, 8 services, all slots) |

> **Important**: Run 011 only for development. Do NOT seed production.

---

## Step 3: Update .env.local

Add to `c:/Mayukh Main/Scheduler AI/Scheduler-AI/.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Keep existing (until full migration complete)
JWT_SECRET=scheduleai-super-secret-key-change-in-production
BACKEND_URL=http://localhost:8000
BACKEND_API_KEY=your-backend-secret-key
```

---

## Step 4: Install Supabase JS Client

```bash
npm install @supabase/supabase-js
```

---

## Step 5: Create lib/supabase.ts

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side client (anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnon)

// Server-side admin client (service role key, bypasses RLS)
// Use ONLY in API routes, never in client components
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})
```

---

## Step 6: Generate Real Password Hashes for Seed Data

The seed data uses placeholder bcrypt hashes. Generate real ones:

```python
import bcrypt
password = b"demo1234"
hash = bcrypt.hashpw(password, bcrypt.gensalt(12)).decode()
print(hash)
```

Then run in Supabase SQL Editor:
```sql
UPDATE users SET password_hash = '<generated_hash>' WHERE email = 'demo@scheduleai.com';
UPDATE users SET password_hash = '<generated_hash>' WHERE email = 'thestylestudio@demo.com';
-- (repeat for each demo account)
```

---

## Database Schema Diagram

```
users (id, email, name, role, password_hash)
  │
  ├──[1:1]── provider_profiles (id, user_id, business_name, category, location, rating...)
  │               │
  │               ├──[1:N]── provider_search_tags (provider_id, tag)  ← AI agent uses this
  │               ├──[1:N]── availability_slots (provider_id, day_of_week/specific_date, start_time)
  │               └──[1:N]── services (id, provider_id, name, price, duration, embedding...)
  │                               │
  │                               └──[1:N]── service_tags (service_id, tag)
  │
  ├──[1:N]── user_sessions (user_id, token_hash, expires_at)
  ├──[1:N]── ai_chat_sessions (user_id, conversation_id)
  │               └──[1:N]── ai_chat_messages (session_id, role, content, intent, services)
  │
  └──[1:N]── bookings (user_id, provider_id, service_id, date, start_time, status...)
                  │
                  ├──[1:N]── calendar_events (booking_id, user_id/provider_id, start_at, end_at)
                  ├──[1:1]── reviews (booking_id, reviewer_id, rating, comment)
                  └──[1:N]── booking_conflicts (booking_a_id, booking_b_id)
```

---

## Key Design Decisions

### 1. Unified `users` Table (vs MongoDB's split collections)
MongoDB had `users` (customers) and `service_providers` (providers) as **separate collections**.
In Supabase, a single `users` table with `role` column is used, with `provider_profiles` extending
the provider row. This simplifies auth and RBAC.

### 2. Availability Slots Table (vs MongoDB's embedded map)
MongoDB stored availability as `{ "monday": ["09:00", "10:30"], "2026-08-20": ["09:00"] }`.
In Supabase, each slot is a row in `availability_slots`. This allows:
- Proper SQL queries with indexes
- Easy booking/unbooking (just set `is_booked = TRUE`)
- Date-specific overrides via `specific_date` column

### 3. Services Table (vs MongoDB's embedded array)
MongoDB embedded services inside each provider document. Supabase uses a proper `services` table
with FK → `provider_profiles`. The `legacy_id` column stores the old `"{providerId}:{index}"` string
for backwards compatibility with any existing booking records.

### 4. Double-Booking Prevention (two layers)
- **Partial unique index**: `(provider_id, date, start_time)` WHERE active status — exact match prevention
- **EXCLUDE USING GIST**: `tsrange(date+start_time, date+end_time) WITH &&` — duration-overlap prevention

### 5. pgvector Semantic Search
The `services.embedding` column stores 1536-dim vectors (OpenAI text-embedding-3-small compatible).
The AI agent can use: `SELECT * FROM services ORDER BY embedding <=> $query_vector LIMIT 10;`

### 6. RBAC via RLS
All tables have Row Level Security enabled. Users can only see/modify their own data.
The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS — use only server-side.
