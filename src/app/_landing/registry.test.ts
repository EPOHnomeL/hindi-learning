import { expect, test } from "vitest";
import type { ComponentType } from "react";
import { LANDING_REGISTRY, landingFor } from "./registry";
import { TENANT_SLUGS } from "../../lib/tenant";

// Stand-in components: the lookup only ever compares/returns references, so plain
// functions stand in for real landing pages without pulling the client tree into
// the edge-runtime test env.
const Fake: ComponentType = () => null;

test("landingFor: an unregistered slug falls through (null → page.tsx renders <Landing/>)", () => {
  // The v1 registry is empty, so every real tenant must fall through.
  for (const slug of TENANT_SLUGS) {
    expect(landingFor(slug)).toBeNull();
  }
});

test("landingFor: the default site (slug null) never gets a bespoke page", () => {
  expect(landingFor(null)).toBeNull();
  expect(landingFor(null, { upf: Fake })).toBeNull();
});

test("landingFor: a registered slug resolves to its component, others stay null", () => {
  const registry = { upf: Fake };
  expect(landingFor("upf", registry)).toBe(Fake);
  // Registering one tenant must not leak into another's route.
  expect(landingFor("yknot", registry)).toBeNull();
});

test("LANDING_REGISTRY ships empty (v1: every tenant re-skins the default <Landing/>)", () => {
  expect(Object.keys(LANDING_REGISTRY)).toHaveLength(0);
});
