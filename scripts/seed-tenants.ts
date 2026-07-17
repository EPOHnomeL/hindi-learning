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
        danger: "#c0432f", good: "#3f7d54", "good-b": "#cfe6d6", bad: "#c0432f", "bad-b": "#f2d6cf",
      },
    },
  },
  {
    slug: "ywampotch",
    displayName: "YWAM Potch",
    theme: {
      // YWAM Potch brand (ywampotch.com): slate blue-greys + a gold ornament.
      light: {
        paper: "#f7f8fa", card: "#ffffff", ink: "#222930", soft: "#727f97", line: "#dee3ea",
        accent: "#394250", accent2: "#8496b3", gold: "#e0bf5c", hi: "#eaeef4",
        danger: "#c0432f", good: "#3f7d54", "good-b": "#cfe6d6", bad: "#c0432f", "bad-b": "#f2d6cf",
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
        danger: "#c0432f", good: "#3f7d54", "good-b": "#cfe6d6", bad: "#c0432f", "bad-b": "#f2d6cf",
      },
    },
  },
  {
    // Real Yknot brand system (mapped from the Brand Showcase reference):
    // Knot #a48a66 = primary accent/CTAs, Sails #49a2b7 = secondary/links, warm
    // greys for text/borders, pale blue highlight. Light-only — the brand is
    // specified for light backgrounds, so dark falls back to the app default.
    // State colours (danger/good/bad) are app defaults: the brand has no red/green.
    slug: "yknot",
    displayName: "Y-Knot",
    theme: {
      light: {
        paper: "#f8f8f8", card: "#ffffff", ink: "#111827", soft: "#858fa2", line: "#ede7e0",
        accent: "#a48a66", accent2: "#49a2b7", gold: "#a48a66", hi: "#e7faff",
        danger: "#c0432f", good: "#3f7d54", "good-b": "#cfe6d6", bad: "#c0432f", "bad-b": "#f2d6cf",
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
