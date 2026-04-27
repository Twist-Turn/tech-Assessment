import type { HandlerEvent } from "@netlify/functions";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface AuthContext {
  userId: string;
  email?: string;
  name?: string;
}

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

let secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (secret) return secret;
  const s = process.env.JWT_SECRET;
  if (!s) throw new AuthError("Server not configured (missing JWT_SECRET)", 500);
  secret = new TextEncoder().encode(s);
  return secret;
}

const TOKEN_TTL = "7d";

export async function signJwt(payload: { sub: string; email: string; name: string }): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());
}

export async function requireAuth(event: HandlerEvent): Promise<AuthContext> {
  const header =
    event.headers["authorization"] ||
    event.headers["Authorization"] ||
    "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new AuthError("Missing bearer token");

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(match[1], getSecret(), { algorithms: ["HS256"] });
    payload = verified.payload;
  } catch {
    throw new AuthError("Invalid or expired token");
  }

  if (!payload.sub) throw new AuthError("Token missing sub");
  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}
