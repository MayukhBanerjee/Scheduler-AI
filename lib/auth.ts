/**
 * lib/auth.ts
 * Full auth helpers for Next.js API Routes (Node.js runtime only).
 * Uses Supabase (service role) instead of MongoDB + bcryptjs.
 *
 * For Edge-safe JWT methods (used in middleware), see lib/auth-edge.ts.
 */

import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";
import bcrypt from "bcryptjs";
import { verifyToken, signToken, COOKIE_NAME } from "./auth-edge";

export type { JWTPayload } from "./auth-edge";
export { signToken, COOKIE_NAME };

// ─── Cookie helpers ────────────────────────────────────────────────────────────

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  };
}

// ─── User Registration ─────────────────────────────────────────────────────────

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  role: "user" | "provider";
  businessName?: string;
  category?: string;
  location?: string;
}) {
  // Check if email is already taken
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", data.email)
    .maybeSingle();

  if (existing) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  // Insert the unified user row
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .insert({
      name: data.role === "provider" ? (data.businessName || data.name) : data.name,
      email: data.email,
      password_hash: passwordHash,
      role: data.role,
    })
    .select("id, email, name, role")
    .single();

  if (userError || !user) {
    throw new Error(userError?.message || "Registration failed");
  }

  // If provider, also create the provider_profile row
  if (data.role === "provider") {
    const location = data.location || "";
    const { error: profileError } = await supabaseAdmin
      .from("provider_profiles")
      .insert({
        user_id: user.id,
        business_name: data.businessName || data.name,
        owner_name: data.name,
        category: data.category || "General",
        location,
        rating: 5.0,
      });

    if (profileError) {
      // Clean up user row on failure
      await supabaseAdmin.from("users").delete().eq("id", user.id);
      throw new Error(profileError.message || "Failed to create provider profile");
    }
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "user" | "provider",
  };
}

// ─── User Login ────────────────────────────────────────────────────────────────

export async function loginUser(data: {
  email: string;
  password: string;
  role: "user" | "provider";
}) {
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, email, name, role, password_hash")
    .eq("email", data.email)
    .eq("role", data.role)
    .maybeSingle();

  if (error || !user) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(data.password, user.password_hash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "user" | "provider",
  };
}
