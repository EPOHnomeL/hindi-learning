// Operator migration (whitelabel issue 23): move an EXISTING course under a
// tenant and re-bake its stored lesson/reference/translation blobs to that
// tenant's full palette. Issue 13 injects only the 14 contract vars at render
// time; head.html hardcodes dozens of hex literals BEYOND those, so a legacy
// course never fully matches a tenant-generated one until it's re-baked here.
//
// Which course → which tenant is a CONTENT decision (never inferred): the
// operator names both. The re-bake is a value substitution — every occurrence
// of a DEFAULT palette hex (the design system's `:root{}` in head.html) is
// swapped for the tenant's corresponding hex, so both the `:root{}` var
// declarations AND the hardcoded literals that reused those same values (e.g.
// `border:1px solid #e7ddd4`, the default `--line`) follow the brand. Literals
// that aren't a default token value stay as-authored — partial-but-more fidelity
// than the render-time override, which is exactly this issue's remit.
//
// Idempotent: a baked blob carries a sentinel comment; a second run skips it, so
// re-running never double-migrates or corrupts (AC3). The default palette is read
// live from head.html (the single source of truth), so this never drifts from the
// design system.
//
//   Usage: pnpm tenant-course-backfill <course-slug> <tenant-slug>          (dev)
//          pnpm tenant-course-backfill <course-slug> <tenant-slug> --prod   (live —
//                                                     take a Convex snapshot first!)
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { TENANT_THEME_TOKENS } from "../src/design/tokens";
import { convexUrl, publishSecret } from "./_env";

type Palette = Record<string, string>;
type Theme = { light: Palette; dark?: Palette };
type Substitution = { from: string; to: string };

// The marker a re-baked blob carries. Its presence is the idempotency gate:
// bakeTenantPalette skips any blob already stamped, so a second run over the same
// course is a safe no-op (AC3) regardless of whether a tenant hex happens to
// collide with a default one.
export const BAKE_SENTINEL = "<!--tenant-palette-baked-->";

// Pull the design system's default palettes out of head.html: the light `:root{}`
// block and the dark `:root[data-theme="dark"]{}` block. Only the 14 contract
// tokens are kept (head.html also defines `--book`/`--book-bg`, which aren't a
// tenant concern). Reading head.html live means the bake's idea of "default" can
// never drift from what publish.ts actually inlines. The light-block regex won't
// match `:root[data-theme…` (a `[` sits before its `{`), and the dark-block one
// only matches the bare palette selector, not `:root[data-theme="dark"] .foo{…}`.
export function extractRootPalette(headHtml: string): { light: Palette; dark: Palette } {
  const known = new Set<string>(TENANT_THEME_TOKENS);
  const parseBlock = (re: RegExp): Palette => {
    const body = headHtml.match(re)?.[1] ?? "";
    const palette: Palette = {};
    for (const decl of body.split(";")) {
      const m = decl.match(/--([\w-]+)\s*:\s*(.+)/);
      if (m && known.has(m[1]!)) palette[m[1]!] = m[2]!.trim();
    }
    return palette;
  };
  return {
    light: parseBlock(/:root\s*\{([^}]*)\}/),
    dark: parseBlock(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/),
  };
}

// Build the default-hex → tenant-hex swaps. Light covers all 14 tokens; dark is
// added only for the tokens the tenant actually overrides in dark (the rest fall
// through to the default dark palette, matching issue 13's cascade). A no-op swap
// (tenant value equals the default) is dropped, and a duplicate `from` keeps the
// first mapping so the single-pass replace stays deterministic.
export function buildSubstitutions(defaults: { light: Palette; dark: Palette }, theme: Theme): Substitution[] {
  const subs: Substitution[] = [];
  const seen = new Set<string>();
  const push = (from: string | undefined, to: string | undefined) => {
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) return;
    const key = from.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    subs.push({ from, to });
  };
  for (const tok of TENANT_THEME_TOKENS) push(defaults.light[tok], theme.light[tok]);
  if (theme.dark) for (const tok of TENANT_THEME_TOKENS) push(defaults.dark[tok], theme.dark![tok]);
  return subs;
}

// Re-bake one stored blob: swap every default palette hex for the tenant's, then
// stamp the sentinel. Already-stamped input is returned untouched (`baked:false`)
// so re-runs are safe. The swap is a SINGLE left-to-right pass over one alternation
// of the 6-digit hex cores, so an already-substituted value is never re-matched —
// and matching only the core leaves any alpha suffix intact (`#b88a2e10`, a shadow
// tint, becomes `#<tenant-gold>10`). The sentinel is appended at the very end, so
// it never risks quirks-mode on a full document and survives buildSrcDoc's
// head/body splices (they slice around </head>/</body>, keeping the tail).
export function bakeTenantPalette(html: string, substitutions: Substitution[]): { html: string; baked: boolean } {
  if (html.includes(BAKE_SENTINEL)) return { html, baked: false };
  let out = html;
  if (substitutions.length > 0) {
    const map = new Map<string, string>();
    for (const { from, to } of substitutions) {
      const body = from.replace(/^#/, "").toLowerCase();
      const value = to.startsWith("#") ? to : `#${to}`;
      if (!map.has(body)) map.set(body, value);
    }
    const re = new RegExp(`#(${[...map.keys()].join("|")})`, "gi");
    out = out.replace(re, (m, body: string) => map.get(body.toLowerCase()) ?? m);
  }
  return { html: out + BAKE_SENTINEL, baked: true };
}

async function main(argv: string[]): Promise<void> {
  const PROD = argv.includes("--prod");
  const [courseSlug, tenantSlug] = argv.filter((a) => !a.startsWith("--"));
  if (!courseSlug || !tenantSlug) {
    throw new Error("usage: pnpm tenant-course-backfill <course-slug> <tenant-slug> [--prod]");
  }

  const secret = publishSecret();
  const client = new ConvexHttpClient(convexUrl(PROD));

  const defaults = extractRootPalette(readFileSync("lessons/_partials/head.html", "utf8"));

  const tenant = await client.query(api.tenants.getTheme, { slug: tenantSlug });
  if (!tenant) throw new Error(`No tenant with slug "${tenantSlug}" — seed it first (pnpm seed-tenants).`);
  const subs = buildSubstitutions(defaults, tenant.theme);

  const { topicId, artifacts } = await client.query(api.tenantBackfill.courseArtifacts, { secret, courseSlug });

  console.log(
    `Backfilling "${courseSlug}" → tenant "${tenantSlug}" on ${PROD ? "PROD (live site)" : "dev"} ` +
      `(${artifacts.length} artifact(s), ${subs.length} palette swap(s))…`,
  );

  // Assign first, so the course is the tenant's even if a later blob write is
  // interrupted; a re-run then resumes the re-bake (sentinel-skipping the done).
  await client.mutation(api.tenantBackfill.setCourseTenant, { secret, topicId, tenantSlug });

  let baked = 0;
  let skipped = 0;
  for (const a of artifacts) {
    const html = await client.action(api.tenantBackfill.readArtifactHtml, { secret, table: a.table, id: a.id });
    if (html == null) {
      skipped++;
      continue;
    }
    const res = bakeTenantPalette(html, subs);
    if (!res.baked) {
      skipped++; // already stamped — idempotent
      continue;
    }
    await client.action(api.tenantBackfill.writeArtifactHtml, { secret, table: a.table, id: a.id, html: res.html });
    baked++;
  }

  console.log(`done. ${baked} re-baked, ${skipped} skipped (already baked / empty).`);
}

// Run the CLI only when invoked directly, so the test can import the pure helpers.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
