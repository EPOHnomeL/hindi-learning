import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// Resolves the authenticated learner from a request using Neon Auth (ADR-0006,
// the Better Auth-based service). The client signs in with @neondatabase/neon-js
// and sends its access token as `Authorization: Bearer <jwt>`; here we verify
// that JWT against the branch's JWKS endpoint and return the user id (the token
// `sub`), which is the Hub's user id. Tokens are EdDSA-signed and the issuer is
// the origin of the auth URL (per Neon Auth's JWT plugin docs).
//
// Until Neon Auth is configured (no NEON_AUTH_URL), the resolver returns
// undefined so the caller can fall back to the dev user — local dev keeps working
// with no auth. The JWKS getter is injectable so the verification path is unit-
// testable offline (see auth.test.ts).

export interface AuthEnv {
  /**
   * Neon Auth base URL for the branch, e.g.
   * https://ep-xxx.neonauth.<region>.aws.neon.tech/<db>/auth
   * Absent locally → auth disabled (dev fallback).
   */
  NEON_AUTH_URL?: string;
}

export type UserResolver = (request: Request) => Promise<string | undefined>;

/** Pulls the bearer token out of the Authorization header, if present. */
export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

/** The JWKS endpoint for a Neon Auth base URL. */
export function jwksUrl(authUrl: string): string {
  return `${authUrl.replace(/\/+$/, "")}/.well-known/jwks.json`;
}

/**
 * Builds a resolver for the given env. When NEON_AUTH_URL is unset, returns a
 * resolver that always yields undefined (dev fallback). `getKey` is injectable
 * for tests; in production it is a remote JWKS set fetched from the auth branch.
 */
export function makeUserResolver(env: AuthEnv, getKey?: JWTVerifyGetKey): UserResolver {
  if (!env.NEON_AUTH_URL) {
    return async () => undefined;
  }
  const issuer = new URL(env.NEON_AUTH_URL).origin;
  const keys = getKey ?? createRemoteJWKSet(new URL(jwksUrl(env.NEON_AUTH_URL)));
  return async (request) => {
    const token = bearerToken(request);
    if (!token) return undefined;
    try {
      const { payload } = await jwtVerify(token, keys, { issuer });
      return typeof payload.sub === "string" ? payload.sub : undefined;
    } catch {
      return undefined; // invalid/expired/foreign-issuer token → unauthenticated
    }
  };
}
