import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// Resolves the authenticated learner from a request using Neon Auth (Stack Auth,
// ADR-0006). The client signs in with the Stack SDK and sends its access token as
// `Authorization: Bearer <jwt>`; here we verify that JWT against the project's
// JWKS and return the Stack user id (the token `sub`), which is the Hub's user id.
//
// Until Neon Auth is configured (no STACK_PROJECT_ID), the resolver returns
// undefined so the caller can fall back to the dev user — local dev keeps working
// with no auth. The JWKS getter is injectable so the verification path is unit-
// testable offline (see auth.test.ts).

export interface AuthEnv {
  /** Neon Auth / Stack project id. Absent locally → auth disabled (dev fallback). */
  STACK_PROJECT_ID?: string;
}

export type UserResolver = (request: Request) => Promise<string | undefined>;

/** Pulls the bearer token out of the Authorization header, if present. */
export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

/** The JWKS endpoint for a Stack/Neon Auth project. */
export function stackJwksUrl(projectId: string): string {
  return `https://api.stack-auth.com/api/v1/projects/${projectId}/.well-known/jwks.json`;
}

/**
 * Builds a resolver for the given env. When STACK_PROJECT_ID is unset, returns a
 * resolver that always yields undefined (dev fallback). `getKey` is injectable for
 * tests; in production it is a remote JWKS set fetched from the Stack project.
 */
export function makeUserResolver(env: AuthEnv, getKey?: JWTVerifyGetKey): UserResolver {
  if (!env.STACK_PROJECT_ID) {
    return async () => undefined;
  }
  const keys = getKey ?? createRemoteJWKSet(new URL(stackJwksUrl(env.STACK_PROJECT_ID)));
  return async (request) => {
    const token = bearerToken(request);
    if (!token) return undefined;
    try {
      const { payload } = await jwtVerify(token, keys);
      return typeof payload.sub === "string" ? payload.sub : undefined;
    } catch {
      return undefined; // invalid/expired token → unauthenticated
    }
  };
}
