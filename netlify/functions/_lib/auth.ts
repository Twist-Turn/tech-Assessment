import type { HandlerEvent } from "@netlify/functions";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface AuthContext {
  userId: string;
  email?: string;
}

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let issuer = "";

function getJwks() {
  if (jwks) return jwks;
  const url = process.env.SUPABASE_URL;
  if (!url) throw new AuthError("Server not configured (missing SUPABASE_URL)", 500);
  issuer = `${url.replace(/\/$/, "")}/auth/v1`;
  jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return jwks;
}

export async function requireAuth(event: HandlerEvent): Promise<AuthContext> {
  const header =
    event.headers["authorization"] ||
    event.headers["Authorization"] ||
    "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new AuthError("Missing bearer token");

  const token = match[1];
  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, getJwks(), {
      issuer,
      audience: "authenticated",
    });
    payload = verified.payload;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError("Invalid or expired token");
  }

  if (!payload.sub) throw new AuthError("Token missing sub");
  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}
