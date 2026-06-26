// Reports the outcome of a next-lesson Routine run back to the Hub, releasing
// the single-flight lock the reader watches (ADR 0008). Called by the cloud
// agent as the LAST step of every run — including on failure (in a finally).
// Usage: pnpm run report:prod <published|nothing|failed> [topicSlug] ["error message"]
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const [outcome, topicSlug, error] = process.argv.slice(2).filter((a) => a !== "--prod");

// topicSlug is required: the Routine is multi-topic now, so a default would
// silently release the wrong Topic's lock.
if ((outcome !== "published" && outcome !== "nothing" && outcome !== "failed") || !topicSlug) {
  console.error('Usage: pnpm run report:prod <published|nothing|failed> <topicSlug> ["error message"]');
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl(PROD));
await client.mutation(api.routine.reportGeneration, {
  secret: publishSecret(),
  topicSlug,
  outcome,
  error,
});
console.log(`reported ${outcome} for "${topicSlug}".`);
