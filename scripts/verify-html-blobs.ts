// Read-only integrity check before dropping inline `html` (.scratch/html-blob-storage
// issue 05). For every body row it confirms a content blob exists AND its bytes
// equal the inline `html`. Safe to narrow only when `stranded` and `mismatched`
// are both 0 across all tables.
//   Usage: pnpm run verify-html-blobs          (dev)
//          pnpm run verify-html-blobs --prod   (live)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const client = new ConvexHttpClient(convexUrl(PROD));

console.log(`Verifying content blobs against inline html on ${PROD ? "PROD (live site)" : "dev"}…`);

let totalStranded = 0;
let totalMismatched = 0;
for (const table of ["lessons", "references", "translations"] as const) {
  let cursor: string | null = null;
  const sum = { bodies: 0, matched: 0, mismatched: 0, stranded: 0, blobOnly: 0 };
  for (;;) {
    const r: { bodies: number; matched: number; mismatched: number; stranded: number; blobOnly: number; isDone: boolean; cursor: string | null } =
      await client.action(api.backfill.verifyHtmlBlobs, { secret, table, cursor });
    sum.bodies += r.bodies;
    sum.matched += r.matched;
    sum.mismatched += r.mismatched;
    sum.stranded += r.stranded;
    sum.blobOnly += r.blobOnly;
    if (r.isDone) break;
    cursor = r.cursor;
  }
  totalStranded += sum.stranded;
  totalMismatched += sum.mismatched;
  console.log(
    `${table.padEnd(12)} bodies=${sum.bodies} matched=${sum.matched} blobOnly=${sum.blobOnly} ` +
      `mismatched=${sum.mismatched} stranded=${sum.stranded}`,
  );
}

if (totalStranded === 0 && totalMismatched === 0) {
  console.log("\n✓ Every body has a faithful blob — safe to drop inline html.");
} else {
  console.log(`\n✗ NOT safe to drop html: ${totalStranded} stranded, ${totalMismatched} mismatched. Investigate before narrowing.`);
  process.exit(1);
}
