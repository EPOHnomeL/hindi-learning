import { afterEach, expect, test, vi } from "vitest";
import { cookieDomainFor } from "./cookieDomain";

afterEach(() => vi.unstubAllEnvs());

test("host-only (undefined) when NEXT_PUBLIC_COOKIE_DOMAIN is unset", () => {
  vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "");
  expect(cookieDomainFor("upf.my-course.app")).toBeUndefined();
  expect(cookieDomainFor("my-course.app")).toBeUndefined();
});

test.each([
  // The apex and every tenant subdomain scope to the shared parent domain.
  ["my-course.app", "my-course.app"],
  ["upf.my-course.app", "my-course.app"],
  ["almighty-warriors.my-course.app", "my-course.app"],
  ["www.my-course.app", "my-course.app"],
  // Port and case are ignored.
  ["yknot.my-course.app:443", "my-course.app"],
  ["UPF.MY-COURSE.APP", "my-course.app"],
])("%s scopes to the parent domain when configured", (host, expected) => {
  vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "my-course.app");
  expect(cookieDomainFor(host)).toBe(expected);
});

test.each([
  // A host outside the configured domain stays host-only — never leak a Domain
  // onto a preview host or an unexpected domain (a `.vercel.app` Domain would be
  // silently dropped as a public suffix).
  "hindi-learning-git-x.vercel.app",
  "localhost",
  "evil-my-course.app",
  "my-course.app.attacker.com",
  "",
])("%s stays host-only", (host) => {
  vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", "my-course.app");
  expect(cookieDomainFor(host)).toBeUndefined();
});
