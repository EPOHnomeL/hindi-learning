import { expect, test } from "vitest";
import { resolveTenantSlug, TENANT_SLUGS } from "./tenant";

test("TENANT_SLUGS is exactly the four seeded tenants", () => {
  expect([...TENANT_SLUGS].sort()).toEqual(["upf", "ywampotch", "almighty-warriors", "yknot"].sort());
});

test.each([
  // A known subdomain → its slug (leftmost label).
  ["ywampotch.my-course.app", "ywampotch"],
  ["upf.my-course.app", "upf"],
  ["yknot.my-course.app", "yknot"],
  // Hyphenated slug: the hyphen is within the label, not a separator.
  ["almighty-warriors.my-course.app", "almighty-warriors"],
  // Local dev: <slug>.localhost with a port suffix.
  ["ywampotch.localhost:3000", "ywampotch"],
  // Case-insensitive host matching.
  ["YKNOT.my-course.app", "yknot"],
  // Bare apex, www, and unknown subdomains → default (no tenant).
  ["my-course.app", null],
  ["www.my-course.app", null],
  ["localhost:3000", null],
  ["foo.my-course.app", null],
  // Degenerate hosts → default.
  ["", null],
])("resolveTenantSlug(%j) → %j", (host, expected) => {
  expect(resolveTenantSlug(host)).toBe(expected);
});

test("null / undefined host → default (no tenant)", () => {
  expect(resolveTenantSlug(null)).toBeNull();
  expect(resolveTenantSlug(undefined)).toBeNull();
});
