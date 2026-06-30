// Minimal env loader for the teach CLI (publish/review/reply). Reads
// .env.local (written by `npx convex dev`) and .env into process.env without a
// dependency, then exposes the two values the CLI needs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function load(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2]!.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]!] === undefined) process.env[m[1]!] = value;
  }
}

load(".env.local");
load(".env");

// ConvexHttpClient rejects a base URL with a trailing slash, so strip any here —
// the env var is set by hand and easily ends up as "https://….convex.cloud/".
const clean = (url: string) => url.replace(/\/+$/, "");

export function convexUrl(prod = false): string {
  if (prod) {
    const url = process.env.CONVEX_PROD_URL;
    if (!url) {
      console.error(
        "Missing CONVEX_PROD_URL — set it in .env.local to your prod deployment URL\n" +
          "(e.g. https://<your-prod>.convex.cloud) so *:prod commands target the live site.",
      );
      process.exit(1);
    }
    return clean(url);
  }
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL — run `npx convex dev` once to create the deployment.");
    process.exit(1);
  }
  return clean(url);
}

export function publishSecret(): string {
  const secret = process.env.PUBLISH_SECRET;
  if (!secret) {
    console.error(
      "Missing PUBLISH_SECRET. Set it locally (.env.local) AND in Convex:\n" +
        "  npx convex env set PUBLISH_SECRET <a-long-random-string>",
    );
    process.exit(1);
  }
  return secret;
}

// The Topic slug a teach-CLI step operates on. `--topic <slug>`, default "hindi"
// (the only Topic until the multi-topic cut-over).
export function topicArg(): string {
  const i = process.argv.indexOf("--topic");
  const slug = i >= 0 ? process.argv[i + 1] : undefined;
  return slug && !slug.startsWith("--") ? slug : "hindi";
}

// Upsert one KEY=value into .env.local so a *later* teach-CLI step (a fresh
// process) picks it up through `load(".env.local")` above. `claim` uses this to
// hand the resolved Topic owner to the owner-scoped steps (materialise/review/
// publish) — they each `load()` it at startup — so no human sets OWNER_EMAIL.
// Replaces an existing line for the key, else appends; idempotent across runs.
export function persistEnvLocal(key: string, value: string): void {
  const file = ".env.local";
  const line = `${key}=${value}`;
  const lines = (existsSync(file) ? readFileSync(file, "utf8") : "").split(/\r?\n/);
  const re = new RegExp(`^\\s*${key}\\s*=`);
  const idx = lines.findIndex((l) => re.test(l));
  if (idx >= 0) {
    lines[idx] = line;
  } else {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push(line);
  }
  writeFileSync(file, `${lines.join("\n")}\n`);
}

// The email of the user who owns the published Topic. The publish path has no
// auth identity, so the owner is named here; the user must already be registered.
// In the Routine, `claim` resolves this from the claimed Topic and persists it to
// .env.local (via persistEnvLocal), so the cloud env need not set it by hand.
export function ownerEmail(): string {
  const email = process.env.OWNER_EMAIL;
  if (!email) {
    console.error(
      "Missing OWNER_EMAIL — set it in .env.local to the registered email that owns the\n" +
        "published Topic (e.g. OWNER_EMAIL=you@example.com).",
    );
    process.exit(1);
  }
  return email;
}
