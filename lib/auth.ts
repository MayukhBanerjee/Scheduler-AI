/**
 * lib/auth.ts
 * Full auth helpers for Next.js API Routes (Node.js runtime only).
 * Imports mongodb and bcryptjs — do NOT import this in middleware.ts.
 *
 * For Edge-safe JWT methods (used in middleware), see lib/auth-edge.ts.
 */

import { cookies } from "next/headers";
import { getDb } from "./mongodb";
import bcrypt from "bcryptjs";
import { verifyToken, signToken, COOKIE_NAME } from "./auth-edge";

export type { JWTPayload } from "./auth-edge";
export { signToken, COOKIE_NAME };

// ─── Cookie helpers ───────────────────────────────────────────────────────────

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

// ─── User Registration ────────────────────────────────────────────────────────

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  role: "user" | "provider";
  businessName?: string;
  category?: string;
  location?: string;
}) {
  const db = await getDb();
  const collection =
    data.role === "provider"
      ? db.collection("service_providers")
      : db.collection("users");

  const existing = await collection.findOne({ email: data.email });
  if (existing) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const now = new Date();

  if (data.role === "provider") {
    const location = data.location || "";
    const category = data.category || "General";
    const result = await collection.insertOne({
      name: data.businessName || data.name,
      ownerName: data.name,
      email: data.email,
      passwordHash,
      category,
      location,
      location_lower: location.toLowerCase(),
      search_tags: [],
      services: [],
      availability: {},
      rating: 5.0,
      role: "provider",
      createdAt: now,
    });
    return {
      userId: result.insertedId.toString(),
      email: data.email,
      name: data.businessName || data.name,
      role: "provider" as const,
    };
  } else {
    const result = await collection.insertOne({
      name: data.name,
      email: data.email,
      passwordHash,
      role: "user",
      createdAt: now,
    });
    return {
      userId: result.insertedId.toString(),
      email: data.email,
      name: data.name,
      role: "user" as const,
    };
  }
}

// ─── User Login ───────────────────────────────────────────────────────────────

export async function loginUser(data: {
  email: string;
  password: string;
  role: "user" | "provider";
}) {
  const db = await getDb();
  const collection =
    data.role === "provider"
      ? db.collection("service_providers")
      : db.collection("users");

  const user = await collection.findOne({ email: data.email });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  return {
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    role: data.role,
  };
}
