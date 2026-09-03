// Seed the four whitelabel tenant rows (issue 07): upf, ywampotch,
// almighty-warriors, yknot — with the mock palettes from ticket 03 (the
// acceptance fixture; the operator replaces these with real per-tenant Claude
// design systems later, via the dashboard) and all five feature flags `true`
// (04's v1-migration default — no regression from today's always-on behaviour).
// Idempotent: seedTenant skips a slug that already exists, so re-running never
// duplicates or overwrites. Creates tenant rows only — assigning tenant admins
// (marking whitelist rows) is a separate operator action with real emails.
//   Usage: pnpm run seed-tenants          (dev)
//          pnpm run seed-tenants --prod   (live — take a Convex snapshot first!)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const client = new ConvexHttpClient(convexUrl(PROD));

type Palette = Record<string, string>;
type Tenant = {
  slug: string;
  displayName: string;
  theme: { light: Palette; dark?: Palette };
};

// Placeholders anchored on the default warm palette. Light for all four; a dark
// variant on yknot only, to exercise the optional partial-dark shape.
const TENANTS: Tenant[] = [
  {
    slug: "upf",
    displayName: "UPF",
    theme: {
      // UPF brand (upfsa.co.za): royal/navy blue.
      light: {
        paper: "#f5f7fb", card: "#ffffff", ink: "#23385a", soft: "#5f6f8f", line: "#dbe2ee",
        accent: "#315087", accent2: "#4567af", gold: "#c2953f", hi: "#e6ecf5",
        danger: "#c0432f", good: "#cfe6d6", "good-b": "#3f7d54", bad: "#f2d6cf", "bad-b": "#c0432f",
      },
    },
  },
  {
    slug: "ywampotch",
    displayName: "YWAM Potch",
    theme: {
      // YWAM Potch brand (from their logo): deep royal-blue wordmark on warm cream.
      light: {
        paper: "#f9f4ea", card: "#fffdf8", ink: "#1e2740", soft: "#6a7290", line: "#ece3d2",
        accent: "#1b2a80", accent2: "#3a52a8", gold: "#d8a93f", hi: "#e7ebf7",
        danger: "#c0432f", good: "#cfe6d6", "good-b": "#3f7d54", bad: "#f2d6cf", "bad-b": "#c0432f",
      },
    },
  },
  {
    slug: "almighty-warriors",
    displayName: "Almighty Warriors",
    theme: {
      // Almighty Warriors brand: monochrome charcoal on white (logo is B/W).
      // State colours stay coloured so quiz right/wrong remains legible.
      light: {
        paper: "#f6f6f6", card: "#ffffff", ink: "#1c1c1c", soft: "#6e6e6e", line: "#e3e3e3",
        accent: "#2d2d2d", accent2: "#565656", gold: "#2d2d2d", hi: "#ededed",
        danger: "#c0432f", good: "#cfe6d6", "good-b": "#3f7d54", bad: "#f2d6cf", "bad-b": "#c0432f",
      },
    },
  },
  {
    // Real Yknot brand system (mapped from the Brand Showcase reference):
    // Knot #a48a66 = primary accent/CTAs, Sails #49a2b7 = secondary/links, warm
    // greys for text/borders, pale blue highlight. Light-only — the brand is
    // specified for light backgrounds, so dark falls back to the app default.
    // State colours (danger/good/bad) follow the app's own semantic: the brand
    // has no red/green of its own. `good`/`bad` are the PALE surfaces and
    // `good-b`/`bad-b` their saturated borders (docs/agents/tenant-branding.md).
    // All four palettes below had that pair INVERTED until 2026-09-03, copied
    // from the worked example in that doc, which made a correct quiz answer
    // render dark-green-on-dark-green in the lesson reader. validateTheme now
    // rejects the swap. NOTE: re-running this script does NOT repair a tenant
    // already in the database, since seedTenant is create-only; an existing
    // tenant needs setTenantTheme / the admin theme editor.
    slug: "yknot",
    displayName: "Y-Knot",
    theme: {
      light: {
        paper: "#f8f8f8", card: "#ffffff", ink: "#111827", soft: "#858fa2", line: "#ede7e0",
        accent: "#a48a66", accent2: "#49a2b7", gold: "#a48a66", hi: "#e7faff",
        danger: "#c0432f", good: "#cfe6d6", "good-b": "#3f7d54", bad: "#f2d6cf", "bad-b": "#c0432f",
      },
    },
  },
];

const FLAGS = { certificates: true, translations: true, publicLinks: true, qa: true, seeding: true };

console.log(`Seeding ${TENANTS.length} tenants on ${PROD ? "PROD (live site)" : "dev"}…`);

for (const { slug, displayName, theme } of TENANTS) {
  const { created } = await client.mutation(api.tenants.seedTenant, { secret, slug, displayName, theme, flags: FLAGS });
  console.log(`  ${created ? "＋ created" : "· exists "}  ${slug}`);
}

console.log("done.");
