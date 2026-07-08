// One-shot backfill: reshuffle the option order of every stored quiz so the
// correct answer is no longer clustered at the first position. Runs over the
// source lessons AND every translated lesson Edition. Deterministic + idempotent
// (see convex/quizShuffle.ts), so re-running is safe.
//   Usage: pnpm run backfill-quiz-shuffle          (dev)
//          pnpm run backfill-quiz-shuffle --prod   (live — take a Convex snapshot first!)
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const client = new ConvexHttpClient(convexUrl(PROD));

console.log(`Reshuffling quiz options on ${PROD ? "PROD (live site)" : "dev"}…`);

for (const table of ["lessons", "translations"] as const) {
  let cursor: string | null = null;
  let patched = 0;
  for (;;) {
    const res: { patched: number; isDone: boolean; cursor: string | null } =
      await client.mutation(api.backfill.backfillQuizShuffle, { secret, table, cursor });
    patched += res.patched;
    if (res.isDone) break;
    cursor = res.cursor;
  }
  console.log(`${table.padEnd(12)} ${patched} reshuffled`);
}

console.log("done.");
