// One place that answers "how long does a sign-in last?".
//
// Three numbers have to agree, and they are read by two different libraries in two
// different units:
//
//   - `SESSION_TOTAL_DURATION_MS` / `SESSION_INACTIVE_DURATION_MS` → the `session`
//     option of `convexAuth()` in convex/auth.ts, in **milliseconds**.
//   - `AUTH_COOKIE_MAX_AGE_SECONDS` → the `cookieConfig.maxAge` option of
//     `convexAuthNextjsMiddleware` in src/middleware.ts, in **seconds**.
//
// The effective lifetime is `min(cookie maxAge, server session)`, so the cookie
// must never be the shorter of the two. Leaving `cookieConfig` off entirely (the
// bug in issue 110) makes the auth cookies *browser-session* cookies: they are
// dropped on browser quit, Chrome restart, or mobile Safari evicting a backgrounded
// tab, while the server-side session is still valid for months. That reads to a
// user as "it logs me out all the time", and no amount of server-side session
// duration fixes it.
//
// convex/ has its own tsconfig and never imports from src/, so convex/auth.ts
// repeats these literals with a pointer back here — same arrangement as
// cookieDomain.ts and the Convex Auth cookie patch. Change them together.

const DAY_MS = 24 * 60 * 60 * 1000;

// A course is worked through over months, and being logged out mid-lesson costs a
// learner their place for no security benefit — nothing here is a banking session.
// The hard cap exists only so a truly abandoned account eventually ages out.
export const SESSION_TOTAL_DURATION_MS = 365 * DAY_MS;

// Rolls forward on activity, so this is the real "how long can I ignore the course
// and still be signed in?" number. Generous enough for a learner who dips in
// monthly (see sessionLifetime.test.ts).
export const SESSION_INACTIVE_DURATION_MS = 60 * DAY_MS;

// Same window as the server session, converted for the `Max-Age` cookie attribute.
export const AUTH_COOKIE_MAX_AGE_SECONDS = SESSION_TOTAL_DURATION_MS / 1000;
