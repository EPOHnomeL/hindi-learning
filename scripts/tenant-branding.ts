// Produce a tenant's branding from a Claude design system (whitelabel workflow;
// see docs/agents/tenant-branding.md). Two mechanical jobs the human/agent split
// leaves to a tool: (1) validate a mapped 14-token palette JSON against the
// contract *before* it hits Convex, and (2) convert supplied logo/favicon art to
// the raster shape setTenantAsset accepts. The judgement — mapping a design
// system's tokens onto the 14 semantic roles — is done by the agent per the doc;
// this only checks and converts.
//
//   Usage:
//     pnpm tenant-branding validate <theme.json>
//     pnpm tenant-branding logo    <src-image> <out.webp|png>
//     pnpm tenant-branding favicon <src-image> <out.png>
//
// Image conversion shells out to `ffmpeg` (native, already on PATH — no new npm
// dependency; note NOT ImageMagick, whose `convert` collides with a Windows disk
// utility). The output is verified against the same 256 KB raster cap
// setTenantAsset enforces, so a too-heavy asset fails here, not at upload.
//
// Format caveat (2026-08-24): the derived App Icon route (src/app/app-icon)
// renders via satori, which CANNOT decode webp; a webp logo is skipped there and
// the icon falls back to the favicon, then the shipped mark. If the tenant's
// logo should appear on their installed app icon, upload it as .png (the 256 KB
// cap still fits a 512px logo).
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { TENANT_THEME_TOKENS, type Token } from "../src/design/tokens";

// Mirror of convex/emblem.ts EMBLEM_IMAGE_MAX_BYTES — the cap setTenantAsset
// (via assertEmblemImage) enforces on the uploaded blob. Kept in sync by hand;
// a script can't import the convex server module cleanly.
export const ASSET_MAX_BYTES = 256 * 1024;

type Palette = Partial<Record<Token, string>>;
type MaybeTheme = { light?: unknown; dark?: unknown };

// Accept the CSS colour forms a design system realistically emits: #rgb / #rrggbb
// / #rrggbbaa, rgb()/rgba()/hsl()/hsla(), and the bare CSS named colours are not
// worth enumerating — anything non-empty that isn't obviously broken passes the
// shape check; the browser is the final arbiter. We reject only empties and
// values with stray braces/semicolons (a sign a whole declaration was pasted).
function looksLikeColor(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0 && !/[;{}]/.test(v);
}

// Validate a mapped tenant theme against the 14-token contract (mirrors
// convex/tenantTheme.ts assertThemeTokens, plus a colour-shape sanity pass). Returns
// a list of human-readable problems — empty means valid. Pure, so it's unit-
// tested; the CLI just prints what this returns.
export function validateTheme(theme: MaybeTheme): string[] {
  const errors: string[] = [];
  const known = new Set<string>(TENANT_THEME_TOKENS);

  if (theme.light == null || typeof theme.light !== "object") {
    return ["theme.light is required and must be an object with all 14 tokens"];
  }
  const light = theme.light as Record<string, unknown>;

  const unknownLight = Object.keys(light).filter((k) => !known.has(k));
  if (unknownLight.length) errors.push(`theme.light has unknown token(s): ${unknownLight.join(", ")}`);
  const missing = TENANT_THEME_TOKENS.filter((tok) => !(tok in light));
  if (missing.length) errors.push(`theme.light is missing required token(s): ${missing.join(", ")}`);
  for (const [k, val] of Object.entries(light)) {
    if (known.has(k) && !looksLikeColor(val)) errors.push(`theme.light.${k} is not a valid colour: ${JSON.stringify(val)}`);
  }

  if (theme.dark != null) {
    if (typeof theme.dark !== "object") {
      errors.push("theme.dark, if present, must be an object (a partial subset of tokens)");
    } else {
      const dark = theme.dark as Record<string, unknown>;
      const unknownDark = Object.keys(dark).filter((k) => !known.has(k));
      if (unknownDark.length) errors.push(`theme.dark has unknown token(s): ${unknownDark.join(", ")}`);
      for (const [k, val] of Object.entries(dark)) {
        if (known.has(k) && !looksLikeColor(val)) errors.push(`theme.dark.${k} is not a valid colour: ${JSON.stringify(val)}`);
      }
      // dark is intentionally partial — no missing-token check (falls back to default dark).
    }
  }
  return errors;
}

// Re-encode supplied art to a compliant raster via ffmpeg. The scale filter
// shrinks to fit within maxDim×maxDim while preserving aspect (never upscales),
// and the output codec follows the file extension (.webp / .png). The size check
// enforces the upload cap. `maxDim` picks the shape: a small favicon vs a larger
// logo. Output format for a logo is best as .webp (smaller under the cap).
function convertImage(src: string, out: string, maxDim: number): void {
  const scale = `scale='min(${maxDim},iw)':'min(${maxDim},ih)':force_original_aspect_ratio=decrease`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", scale, out], { stdio: "inherit" });
  const bytes = statSync(out).size;
  if (bytes > ASSET_MAX_BYTES) {
    throw new Error(
      `${out} is ${(bytes / 1024).toFixed(0)} KB — over the ${ASSET_MAX_BYTES / 1024} KB cap. ` +
        `Re-run with a .webp output, or start from smaller/flatter source art.`,
    );
  }
  console.log(`  ✓ ${out}  (${(bytes / 1024).toFixed(0)} KB)`);
}

function main(argv: string[]): void {
  const [cmd, a, b] = argv;
  if (cmd === "validate") {
    if (!a) throw new Error("usage: pnpm tenant-branding validate <theme.json>");
    const theme = JSON.parse(readFileSync(a, "utf8")) as MaybeTheme;
    const errors = validateTheme(theme);
    if (errors.length) {
      console.error(`✗ ${a} is not a valid tenant theme:`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log(`✓ ${a} is a valid 14-token tenant theme.`);
    return;
  }
  if (cmd === "logo") {
    if (!a || !b) throw new Error("usage: pnpm tenant-branding logo <src-image> <out.webp|png>");
    convertImage(a, b, 512);
    return;
  }
  if (cmd === "favicon") {
    if (!a || !b) throw new Error("usage: pnpm tenant-branding favicon <src-image> <out.png>");
    convertImage(a, b, 64);
    return;
  }
  throw new Error("usage: pnpm tenant-branding <validate|logo|favicon> …");
}

// Run the CLI only when invoked directly, so the test can import the pure helpers.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
