// @vitest-environment node
import { expect, test } from "vitest";
import { TENANT_SLUGS } from "../lib/tenant";
import { TENANT_PILLS, tenantPill } from "./tenantPill";

// The pill's whole decision lives here (whitelabel ticket 25): whether a card
// gets a pill at all, and which colour. The card markup is verified by eye; the
// host rule is verified here, because "no pill on a tenant subdomain" is exactly
// the thing that is invisible when you only ever look at one host.

test("no pill on a tenant subdomain — every listed course is that tenant's", () => {
  for (const host of TENANT_SLUGS) {
    for (const course of [...TENANT_SLUGS, null]) {
      expect(tenantPill(host, course)).toBeNull();
    }
  }
});

test("the default host pills a tenanted course with that tenant's colour", () => {
  for (const slug of TENANT_SLUGS) {
    const pill = tenantPill(null, slug);
    expect(pill, `no pill for ${slug}`).not.toBeNull();
    expect(pill!.label).toBe(TENANT_PILLS[slug].label);
    expect(pill!.colour).toBe(TENANT_PILLS[slug].colour);
  }
});

test("an untenanted course gets no pill (default-site-only, nothing to name)", () => {
  expect(tenantPill(null, null)).toBeNull();
  expect(tenantPill(null, undefined)).toBeNull();
  expect(tenantPill(null, "")).toBeNull();
});

test("an unknown tenant slug gets no pill rather than an uncoloured one", () => {
  // A course could carry a slug retired from TENANT_SLUGS; a missing entry must
  // degrade to no pill, never to `undefined.colour`.
  expect(tenantPill(null, "not-a-tenant")).toBeNull();
});

test("every known tenant has a pill, and no two share a colour", () => {
  const colours = TENANT_SLUGS.map((s) => TENANT_PILLS[s].colour);
  expect(colours).toHaveLength(TENANT_SLUGS.length);
  expect(new Set(colours).size).toBe(colours.length);
  expect(new Set(TENANT_SLUGS.map((s) => TENANT_PILLS[s].label)).size).toBe(TENANT_SLUGS.length);
});
