import { describe, expect, it } from "vitest";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  SESSION_INACTIVE_DURATION_MS,
  SESSION_TOTAL_DURATION_MS,
} from "./sessionLifetime";

// The bug these guard (issue 110): Convex Auth's session config is in
// **milliseconds** and the cookie's `maxAge` is in **seconds**. Mixing them up is
// silent and severe in both directions — seconds-as-ms gives a ~6-minute session,
// ms-as-seconds a cookie outliving the heat death of the account. And because the
// effective lifetime is `min(cookie maxAge, server session)`, a cookie shorter than
// the server session logs people out early for no visible reason, which is exactly
// the class of failure that produced "it logs me out all the time".
describe("session lifetime", () => {
  it("expresses the cookie max-age in seconds, matching the server session in ms", () => {
    expect(AUTH_COOKIE_MAX_AGE_SECONDS).toBe(SESSION_TOTAL_DURATION_MS / 1000);
  });

  it("never lets the cookie expire before the server session it unlocks", () => {
    // A shorter cookie is the early-logout bug; equal is the intent.
    expect(AUTH_COOKIE_MAX_AGE_SECONDS * 1000).toBeGreaterThanOrEqual(SESSION_TOTAL_DURATION_MS);
  });

  it("expires an idle session no later than the hard cap", () => {
    expect(SESSION_INACTIVE_DURATION_MS).toBeLessThanOrEqual(SESSION_TOTAL_DURATION_MS);
  });

  it("uses whole positive numbers a cookie header can carry", () => {
    for (const value of [AUTH_COOKIE_MAX_AGE_SECONDS, SESSION_TOTAL_DURATION_MS, SESSION_INACTIVE_DURATION_MS]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it("keeps a monthly learner signed in", () => {
    // The whole point of the chosen numbers: someone who opens the course every
    // few weeks must never be asked to sign in again.
    const sixWeeksMs = 42 * 24 * 60 * 60 * 1000;
    expect(SESSION_INACTIVE_DURATION_MS).toBeGreaterThan(sixWeeksMs);
  });
});
