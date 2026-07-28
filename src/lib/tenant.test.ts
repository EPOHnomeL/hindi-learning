import { expect, test } from "vitest";
import { canonicalRedirect, resolveTenantSlug, tenantHomeHref, TENANT_SLUGS } from "./tenant";

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

// ---- canonicalRedirect (issue 18) ----------------------------------------

test("tenanted course on the wrong tenant's host → redirect to its subdomain", () => {
  expect(
    canonicalRedirect("https://ywampotch.my-course.app/courses/verbs/lessons/1", "upf"),
  ).toBe("https://upf.my-course.app/courses/verbs/lessons/1");
});

test("tenanted course on the default site → redirect to its subdomain", () => {
  expect(canonicalRedirect("https://my-course.app/courses/verbs", "upf")).toBe(
    "https://upf.my-course.app/courses/verbs",
  );
});

test("untenanted course on a tenant subdomain → redirect to the default site", () => {
  expect(canonicalRedirect("https://ywampotch.my-course.app/courses/verbs", null)).toBe(
    "https://my-course.app/courses/verbs",
  );
});

test("preserves path AND query string when redirecting", () => {
  expect(
    canonicalRedirect("https://my-course.app/courses/verbs/lessons/3?lang=hi&x=1", "upf"),
  ).toBe("https://upf.my-course.app/courses/verbs/lessons/3?lang=hi&x=1");
});

// The default site is served at `www.my-course.app` too, so the base-domain swap
// must strip `www` — otherwise a tenant link off the main site mints the
// unresolvable `<tenant>.www.my-course.app` (the "Server Not Found" bug).
test("tenanted course on the www main site → redirect to its subdomain (no www)", () => {
  expect(canonicalRedirect("https://www.my-course.app/courses/verbs", "yknot")).toBe(
    "https://yknot.my-course.app/courses/verbs",
  );
});

// An untenanted course on `www` is already on the default site — `www` and the apex
// both serve it. Forcing www→apex here fights the host-level www↔apex redirect and
// loops forever, so this MUST be a no-op (null). `www` is only stripped when a tenant
// is being re-attached (see the tenanted-www test above).
test("untenanted course on the www main site → no-op (www already serves the default site)", () => {
  expect(canonicalRedirect("https://www.my-course.app/courses/verbs", null)).toBeNull();
});

// Loop safety: the already-canonical cases MUST be strict no-ops (null), or we
// ship a redirect loop.
test.each([
  // Tenanted course already on its own subdomain.
  ["https://upf.my-course.app/courses/verbs", "upf"],
  // Untenanted course already on the apex default site.
  ["https://my-course.app/courses/verbs", null],
])("already-canonical is a no-op: canonicalRedirect(%j, %j) → null", (url, tenant) => {
  expect(canonicalRedirect(url, tenant as (typeof TENANT_SLUGS)[number] | null)).toBeNull();
});

// ---- tenantHomeHref (welcome/01) -----------------------------------------
//
// The welcome panel's "front door" link. The Guest reader (`/share/<token>`) has
// NO canonical-host bounce — unlike the authed course layout — so a Public link
// pasted on the apex renders a tenanted course under the default skin. There, "/"
// is the wrong home, hence the absolute form.

test.each([
  // Already on the course's canonical host → a plain relative link, no needless
  // cross-origin hop (this is the overwhelmingly common case).
  ["https://ywampotch.my-course.app/share/abc123", "ywampotch", "/"],
  ["https://my-course.app/share/abc123", null, "/"],
  // `www` also serves the default site, so an untenanted course there is home.
  ["https://www.my-course.app/share/abc123", null, "/"],
  // A tenanted course reached off-host → that tenant's portal, absolute.
  ["https://my-course.app/share/abc123", "ywampotch", "https://ywampotch.my-course.app/"],
  ["https://upf.my-course.app/share/abc123", "ywampotch", "https://ywampotch.my-course.app/"],
  // An untenanted course reached on a tenant host → back to the default site.
  ["https://upf.my-course.app/share/abc123", null, "https://my-course.app/"],
])("tenantHomeHref(%j, %j) → %j", (url, tenant, expected) => {
  expect(tenantHomeHref(url, tenant as (typeof TENANT_SLUGS)[number] | null)).toBe(expected);
});

test("tenantHomeHref drops the reader's path, query and hash — the token must not ride along", () => {
  expect(tenantHomeHref("https://my-course.app/share/tok/lessons/0001-a?lang=hi#card", "yknot")).toBe(
    "https://yknot.my-course.app/",
  );
});

test("tenantHomeHref: dev hosts keep their port", () => {
  expect(tenantHomeHref("http://localhost:3000/share/abc", "ywampotch")).toBe("http://ywampotch.localhost:3000/");
  expect(tenantHomeHref("http://ywampotch.localhost:3000/share/abc", "ywampotch")).toBe("/");
});

// Local dev uses <slug>.localhost subdomains (see resolveTenantSlug tests), so
// the base-domain swap must work there too — including the port.
test("dev: swaps the subdomain label on <slug>.localhost, preserving the port", () => {
  expect(canonicalRedirect("http://ywampotch.localhost:3000/courses/verbs", "upf")).toBe(
    "http://upf.localhost:3000/courses/verbs",
  );
  expect(canonicalRedirect("http://ywampotch.localhost:3000/courses/verbs", null)).toBe(
    "http://localhost:3000/courses/verbs",
  );
  expect(canonicalRedirect("http://upf.localhost:3000/courses/verbs", "upf")).toBeNull();
});
