// Narrate a whole course ahead of time, so a learner never waits for a render and
// the bill is spent deliberately rather than by whoever presses play first.
//
//   pnpm narrate:prod --topic prophetic-school            # dry run, costs nothing
//   pnpm narrate:prod --topic prophetic-school --apply    # renders, spends money
//
// DRY RUN BY DEFAULT, like sweep-lesson-text. A dry run makes no provider call at
// all: it reads each lesson, extracts the narration and reports the character
// count, so the cost of the whole course is knowable before a cent is spent.
//
// Resumable: already-rendered lessons are skipped, so hitting a credit quota
// part-way is not a problem. Top up and run it again.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret, topicArg } from "./_env";

const PROD = process.argv.includes("--prod");
const APPLY = process.argv.includes("--apply");
const slug = topicArg();
const client = new ConvexHttpClient(convexUrl(PROD));

// The published multilingual-v2 rate. Flash models are half, on both price and
// the credits a free/metered plan is billed in.
const USD_PER_1K = 0.1;

console.log(`${APPLY ? "Narrating" : "Costing"} "${slug}" on ${PROD ? "PROD (live site)" : "dev"}…\n`);

const { lessons } = await client.action(api.lessonAudio.precompute, {
  secret: publishSecret(),
  topicSlug: slug,
  apply: APPLY,
});

let todo = 0;
let done = 0;
let blocked = 0;
for (const l of lessons) {
  const mark = l.skipped === null ? (l.rendered ? "rendered" : "would render") : l.skipped;
  if (l.skipped === "already rendered") done += l.chars;
  else if (l.skipped) blocked += 1;
  else todo += l.chars;
  console.log(`  ${String(l.seq).padStart(3)}  ${String(l.chars).padStart(6)} chars  ${mark.padEnd(18)} ${l.key}`);
}

const usd = (n: number) => `$${((n / 1000) * USD_PER_1K).toFixed(2)}`;
console.log(`\n${lessons.length} lessons. Already narrated: ${usd(done)} worth.`);
if (blocked) console.log(`${blocked} cannot be narrated as-is (see the marks above).`);
if (APPLY) {
  console.log(`Rendered this run: ${todo} chars, about ${usd(todo)}.`);
} else {
  console.log(`Still to narrate: ${todo} chars, about ${usd(todo)} on multilingual_v2 (half on flash).`);
  console.log(`Nothing was rendered. Re-run with --apply to spend it.`);
}
