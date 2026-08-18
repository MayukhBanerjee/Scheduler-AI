/**
 * lib/supabase.ts
 * Supabase client configuration for ScheduleAI
 * Author: Mayukh Banerjee
 *
 * Two clients:
 *   supabase       — anon key, respects RLS, safe for client components
 *   supabaseAdmin  — service role key, bypasses RLS, SERVER-SIDE ONLY
 *
 * Usage in API routes:
 *   import { supabaseAdmin } from "@/lib/supabase";
 *   const { data, error } = await supabaseAdmin.from("users").select("*")...
 *
 * Usage in client components (read-only, RLS-enforced):
 *   import { supabase } from "@/lib/supabase";
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── Environment Variables ─────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// ─── Public Client (anon key, respects RLS) ───────────────────────────────────
// Safe to use in client components. Access is governed by Row Level Security.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ─── Admin Client (service role, bypasses RLS) ────────────────────────────────
// Use ONLY in Next.js API Routes (server-side). NEVER expose to the browser.
// If SUPABASE_SERVICE_ROLE_KEY is missing (e.g. client bundle), this falls back
// to the anon client to avoid throwing on import.
export const supabaseAdmin: SupabaseClient = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,        // No session management for server client
        autoRefreshToken: false,
      },
    })
  : supabase;  // Fallback — limited to RLS-allowed access only

// ─── Type Helpers ─────────────────────────────────────────────────────────────

export type UserRole = "user" | "provider";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type CalendarEventType = "booking" | "ai_managed" | "google_synced" | "manual";
export type MessageRole = "user" | "assistant" | "system";

// ── Row Types (mirror Supabase table columns) ──────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderProfileRow {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string | null;
  category: string;
  description: string;
  location: string;
  location_lower: string;
  rating: number;
  total_reviews: number;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceRow {
  id: string;
  provider_id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  legacy_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BookingRow {
  id: string;
  user_id: string;
  provider_id: string;
  service_id: string | null;
  user_email: string;
  user_name: string;
  provider_name: string;
  provider_email: string;
  service_name: string;
  location: string;
  price: number;
  date: string;           // "YYYY-MM-DD"
  start_time: string;     // "HH:MM:SS"
  duration_minutes: number;
  end_time: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  legacy_service_id: string | null;
}

export interface CalendarEventRow {
  id: string;
  user_id: string | null;
  provider_id: string | null;
  booking_id: string | null;
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  event_type: CalendarEventType;
  source: string;
  google_event_id: string | null;
  is_synced: boolean;
  color_hex: string;
  has_conflict: boolean;
  is_all_day: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIChatSessionRow {
  id: string;
  user_id: string;
  conversation_id: string;
  title: string | null;
  total_messages: number;
  last_intent: Record<string, unknown> | null;
  last_services: Record<string, unknown>[] | null;
  created_at: string;
  last_active_at: string;
}

export interface AIChatMessageRow {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  intent: Record<string, unknown> | null;
  services: Record<string, unknown>[] | null;
  needs_clarification: boolean;
  turn_index: number;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  booking_id: string;
  reviewer_id: string;
  provider_id: string;
  service_id: string | null;
  rating: number;
  comment: string;
  is_public: boolean;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlotRow {
  id: string;
  provider_id: string;
  day_of_week: string | null;
  specific_date: string | null;
  start_time: string;
  is_booked: boolean;
  created_at: string;
}
