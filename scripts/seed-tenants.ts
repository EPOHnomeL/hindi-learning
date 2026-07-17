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
      light: {
        paper: "#f6f8fb", card: "#ffffff", ink: "#1e2833", soft: "#5b6b7b", line: "#dde5ee",
        accent: "#2f5d8a", accent2: "#4a8f8a", gold: "#c2953f", hi: "#e6eef7",
        danger: "#c0432f", good: "#3f7d54", "good-b": "#cfe6d6", bad: "#c0432f", "bad-b": "#f2d6cf",
      },
    },
  },
  {
    slug: "ywampotch",
    displayName: "YWAM Potch",
    theme: {
      light: {
        paper: "#fdf8f2", card: "#fffefb", ink: "#33261c", soft: "#7a6a58", line: "#ece0d2",
        accent: "#d2662a", accent2: "#2f8f7a", gold: "#cf9a3a", hi: "#fbe9d6",
        danger: "#c14631", good: "#3c8560", "good-b": "#cfe8db", bad: "#c14631", "bad-b": "#f4d8cf",
      },
    },
  },
  {
    slug: "almighty-warriors",
    displayName: "Almighty Warriors",
    theme: {
      light: {
        paper: "#f4f5f8", card: "#ffffff", ink: "#16203a", soft: "#55607a", line: "#d9deea",
        accent: "#1f2f5c", accent2: "#b03a3a", gold: "#c9a227", hi: "#e6e9f4",
        danger: "#b3382f", good: "#3a7d55", "good-b": "#cde5d5", bad: "#b3382f", "bad-b": "#f0d4cf",
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
