/**
 * lib/auth-edge.ts
 * Edge-runtime-safe JWT helpers — NO Node.js built-ins, NO mongodb, NO bcryptjs.
 * Used by middleware.ts which runs in the Next.js Edge runtime.
 */
import { SignJWT, jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "scheduleai-super-secret-key-change-in-production"
)

const TOKEN_EXPIRY = "7d"
export const COOKIE_NAME = "auth_token"

export interface JWTPayload {
  userId: string
  email: string
  role: "user" | "provider"
  name: string
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as unknown as JWTPayload;
    // Discard stale MongoDB ObjectId tokens or invalid sessions
    if (!p || !p.userId || !UUID_REGEX.test(p.userId)) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}
