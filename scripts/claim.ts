// Claims one ready Topic for this Routine run (ADR 0009). The fire body is closed
// (ADR 0008), so a fired run can't be told its Topic — it calls this, which
// atomically hands back one locked-but-unclaimed Topic (and its owner) and stamps
// it claimed. Prints ONLY the slug to stdout (or "none" if nothing is waiting) so
// the Routine can capture it with `SLUG=$(pnpm -s run claim:prod)`; diagnostics go
// to stderr. The resolved owner is persisted to .env.local as OWNER_EMAIL so the
// owner-scoped steps that follow (materialise/review/publish) need no human input.
// Usage: pnpm run claim:prod
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, persistEnvLocal, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const client = new ConvexHttpClient(convexUrl(PROD));

const claimed = await client.mutation(api.routine.claimWork, { secret: publishSecret(), runId });
if (claimed) {
  // Hand the Topic's owner to the (separate-process) owner-scoped steps: persist
  // it so their _env loader reads it — claim is the run's only source of truth for
  // *which* learner this Topic belongs to (the fire body is closed, ADR 0008).
  if (claimed.ownerEmail) {
    persistEnvLocal("OWNER_EMAIL", claimed.ownerEmail);
    console.error(`claimed "${claimed.topicSlug}" (owner ${claimed.ownerEmail}, run ${runId}).`);
  } else {
    console.error(
      `claimed "${claimed.topicSlug}" (run ${runId}) but it has NO owner on record — ` +
        `set OWNER_EMAIL manually before materialise/review/publish.`,
    );
  }
  console.log(claimed.topicSlug);
} else {
  console.error("no ready Topic to claim — nothing to do.");
  console.log("none");
}
