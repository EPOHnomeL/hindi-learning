import { expect, test } from "vitest";
import { oauthRedirectUrl } from "./authRedirect";

// Where an OAuth sign-in is allowed to land. Under ADR 0025 the session cookie is
// host-only, so the host the OAuth callback redirects to *is* the host the user
// ends up signed in on — get it wrong and a tenant sign-in silently succeeds on
// the apex and fails on the subdomain the buyer started from.
//
// `redirectTo` reaches this from the client, so it is untrusted input and the
// host check is a real security boundary, not tidiness.

const SITE = "https://my-course.app";

test("a relative path resolves against the site URL, as it did before tenants", async () => {
  expect(oauthRedirectUrl("/dashboard", SITE)).toBe("https://my-course.app/dashboard");
  expect(oauthRedirectUrl("?buy=1", SITE)).toBe("https://my-course.app/?buy=1");
});

test("a tenant subdomain of the site host is allowed through unchanged", async () => {
  // The whole point: sign-in started on ywampotch must come back to ywampotch.
  expect(oauthRedirectUrl("https://ywampotch.my-course.app/courses/tswana", SITE)).toBe(
    "https://ywampotch.my-course.app/courses/tswana",
  );
  expect(oauthRedirectUrl("https://almighty-warriors.my-course.app/?buy=1", SITE)).toBe(
    "https://almighty-warriors.my-course.app/?buy=1",
  );
});

test("the site host itself is allowed", async () => {
  expect(oauthRedirectUrl("https://my-course.app/dashboard", SITE)).toBe("https://my-course.app/dashboard");
});

test("a www site URL still admits its bare-apex tenants", async () => {
  // Tenant hosts hang off the apex, never off `www.` — same rule `appUrl` follows.
  expect(oauthRedirectUrl("https://ywampotch.my-course.app/", "https://www.my-course.app")).toBe(
    "https://ywampotch.my-course.app/",
  );
});

test("a foreign host is refused — this is an open-redirect that would hand over a session code", async () => {
  expect(() => oauthRedirectUrl("https://evil.com/phish", SITE)).toThrow(/redirectTo/);
});

test("a lookalike host that merely ends with the site name is refused", async () => {
  // `my-course.app.evil.com` ends with the site *name* but is not a subdomain of it.
  expect(() => oauthRedirectUrl("https://my-course.app.evil.com/", SITE)).toThrow(/redirectTo/);
  expect(() => oauthRedirectUrl("https://notmy-course.app/", SITE)).toThrow(/redirectTo/);
});

test("a protocol-relative URL is refused, not silently resolved to a foreign host", async () => {
  // `new URL("//evil.com", "https://my-course.app")` is `https://evil.com/` — the
  // exact trap `appUrl` also guards. A bare `//` must never read as a path.
  expect(() => oauthRedirectUrl("//evil.com", SITE)).toThrow(/redirectTo/);
});

test("a protocol downgrade is refused", async () => {
  expect(() => oauthRedirectUrl("http://ywampotch.my-course.app/", SITE)).toThrow(/redirectTo/);
});

test("localhost keeps its port, so the dev round-trip is not broken by the host check", async () => {
  expect(oauthRedirectUrl("/dashboard", "http://localhost:3000")).toBe("http://localhost:3000/dashboard");
  expect(oauthRedirectUrl("http://localhost:3000/x", "http://localhost:3000")).toBe("http://localhost:3000/x");
  // A different port is a different origin and must not pass.
  expect(() => oauthRedirectUrl("http://localhost:9999/x", "http://localhost:3000")).toThrow(/redirectTo/);
});

test("garbage is refused rather than resolved to something plausible", async () => {
  expect(() => oauthRedirectUrl("http://", SITE)).toThrow(/redirectTo/);
});
