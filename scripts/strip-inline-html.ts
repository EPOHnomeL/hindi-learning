// Strip the redundant inline `html` field from Lesson / Reference rows whose
// body is already in a content blob — the DATA step that must run BEFORE the
// schema narrow (.scratch/html-blob-storage issue 05). Safe (never strips a row
// without a blob) and idempotent. Run AFTER `verify-html-blobs` is clean.
//   Usage: pnpm run strip-inline-html          (dev)
//          pnpm run strip-inline-html --prod   (live — snapshot first)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const client = new ConvexHttpClient(convexUrl(PROD));

console.log(`Stripping inline html from lessons + references on ${PROD ? "PROD (live site)" : "dev"}…`);

for (const table of ["lessons", "references"] as const) {
  let cursor: string | null = null;
  let stripped = 0;
  let skipped = 0;
  for (;;) {
    const r: { stripped: number; skipped: number; isDone: boolean; cursor: string | null } =
      await client.mutation(api.backfill.stripInlineHtml, { secret, table, cursor });
    stripped += r.stripped;
    skipped += r.skipped;
    if (r.isDone) break;
    cursor = r.cursor;
  }
  console.log(`${table.padEnd(12)} ${stripped} stripped${skipped ? `, ${skipped} SKIPPED (no blob — investigate!)` : ""}`);
}

console.log("done.");
