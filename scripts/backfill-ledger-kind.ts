// One-shot backfill (ADR 0027): stamp `kind: "sale"` onto every Ledger row
// written before the donation rail existed. Every pre-0027 row IS a sale, so
// this only makes explicit what was already true. Idempotent — a row that
// already carries a `kind` is skipped, so re-running is safe.
//
// Run this on prod BEFORE narrowing `ledger.kind` to required in the schema.
//   Usage: pnpm run backfill-ledger-kind          (dev)
//          pnpm run backfill-ledger-kind:prod     (live — take a Convex snapshot first!)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const client = new ConvexHttpClient(convexUrl(PROD));

console.log(`Stamping ledger.kind on ${PROD ? "PROD (live site)" : "dev"}…`);

let cursor: string | null = null;
let patched = 0;
for (;;) {
  const res: { patched: number; isDone: boolean; cursor: string | null } = await client.mutation(
    api.backfill.backfillLedgerKind,
    { secret, cursor },
  );
  patched += res.patched;
  if (res.isDone) break;
  cursor = res.cursor;
}

console.log(`${patched} ledger row(s) stamped "sale".`);
