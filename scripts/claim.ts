// Claims one ready Topic for this Routine run (ADR 0009). The fire body is closed
// (ADR 0008), so a fired run can't be told its Topic — it calls this, which
// atomically hands back one locked-but-unclaimed Topic and stamps it claimed.
// Prints ONLY the slug to stdout (or "none" if nothing is waiting) so the Routine
// can capture it with `SLUG=$(pnpm -s run claim:prod)`; diagnostics go to stderr.
// Usage: pnpm run claim:prod
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const client = new ConvexHttpClient(convexUrl(PROD));

const claimed = await client.mutation(api.routine.claimWork, { secret: publishSecret(), runId });
if (claimed) {
  console.error(`claimed "${claimed.topicSlug}" (run ${runId}).`);
  console.log(claimed.topicSlug);
} else {
  console.error("no ready Topic to claim — nothing to do.");
  console.log("none");
}
