// Minimal env loader for the teach CLI (publish/review/reply). Reads
// .env.local (written by `npx convex dev`) and .env into process.env without a
// dependency, then exposes the two values the CLI needs.
import { existsSync, readFileSync } from "node:fs";

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

export function convexUrl(): string {
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    console.error("Missing NEXT_PUBLIC_CONVEX_URL — run `npx convex dev` once to create the deployment.");
    process.exit(1);
  }
  return url;
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
