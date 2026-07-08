// Reports the outcome of a next-lesson Routine run back to the Hub, releasing
// the single-flight lock the reader watches (ADR 0008). Called by the cloud
// agent as the LAST step of every run — including on failure (in a finally).
// `--estimate <n>` folds in the run's best-guess total Lesson count (PRD:
// `~N lessons`), a soft advisory forecast; omitting it leaves any prior estimate
// untouched.
// Usage: pnpm run report:prod <published|nothing|failed> <topicSlug> ["error message"] [--estimate <n>]
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");

// Read `--name value`, ignoring a missing value or one that's actually the next flag.
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
}

const estimateArg = flag("--estimate");

// The positionals are everything that isn't a flag or a flag's value.
const consumed = new Set<string>(["--prod"]);
const ei = process.argv.indexOf("--estimate");
if (ei >= 0) {
  consumed.add(process.argv[ei]!);
  if (process.argv[ei + 1]) consumed.add(process.argv[ei + 1]!);
}
const [outcome, topicSlug, error] = process.argv.slice(2).filter((a) => !consumed.has(a));

// topicSlug is required: the Routine is multi-topic now, so a default would
// silently release the wrong Topic's lock.
if ((outcome !== "published" && outcome !== "nothing" && outcome !== "failed") || !topicSlug) {
  console.error('Usage: pnpm run report:prod <published|nothing|failed> <topicSlug> ["error message"] [--estimate <n>]');
  process.exit(1);
}

const estimatedLessons = estimateArg !== undefined ? Number(estimateArg) : undefined;
if (estimatedLessons !== undefined && !Number.isFinite(estimatedLessons)) {
  console.error(`--estimate must be a number (got "${estimateArg}").`);
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl(PROD));
await client.mutation(api.routine.reportGeneration, {
  secret: publishSecret(),
  topicSlug,
  outcome,
  error,
  ...(estimatedLessons !== undefined ? { estimatedLessons } : {}),
});
console.log(`reported ${outcome} for "${topicSlug}"${estimatedLessons !== undefined ? ` (≈${estimatedLessons} lessons)` : ""}.`);
