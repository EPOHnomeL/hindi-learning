// One-shot backfill: move every existing inline `html` body (Lessons,
// References, and translated lesson/reference rows) into a Convex File Storage
// blob, recording `htmlStorageId`. Idempotent — a row already migrated is
// skipped — so re-running is safe. Inline `html` is LEFT in place until the
// narrow step drops it (.scratch/html-blob-storage, issues 04 + 05).
//   Usage: pnpm run backfill-html-blobs          (dev)
//          pnpm run backfill-html-blobs --prod   (live — take a Convex snapshot first!)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const client = new ConvexHttpClient(convexUrl(PROD));

console.log(`Moving HTML bodies into content blobs on ${PROD ? "PROD (live site)" : "dev"}…`);

for (const table of ["lessons", "references", "translations"] as const) {
  let cursor: string | null = null;
  let patched = 0;
  let scanned = 0;
  for (;;) {
    const res: { patched: number; scanned: number; isDone: boolean; cursor: string | null } =
      await client.action(api.backfill.backfillHtmlBlobs, { secret, table, cursor });
    patched += res.patched;
    scanned += res.scanned;
    if (res.isDone) break;
    cursor = res.cursor;
  }
  console.log(`${table.padEnd(12)} ${patched} migrated (${scanned} scanned)`);
}

console.log("done.");
