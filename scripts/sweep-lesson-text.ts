// Bulk wording fix across one Topic's live source Lessons — the driver for
// `backfill.sweepLessonText`. For a change the owner would otherwise make by
// opening every lesson and retyping the same words (the first use: the header
// pill's "Vehicle:" → "Scripture:" on a Bible course, wrong in the authoring
// template until 2026-08-05).
//
// A literal string swap, guarded per lesson by the same quiz-structure check the
// owner's in-place edit uses. DRY RUN BY DEFAULT — read the report, then re-run
// with --apply.
//
//   pnpm run sweep-lesson-text:prod --topic <slug> --from "Vehicle:" --to "Scripture:"
//   pnpm run sweep-lesson-text:prod --topic <slug> --from "Vehicle:" --to "Scripture:" --apply
//
// NOTE: a swept lesson's body id changes, so every translated Edition row for it
// goes stale and a later re-translate regenerates it. Same as any owner edit.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret, topicArg } from "./_env";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

const PROD = process.argv.includes("--prod");
const APPLY = process.argv.includes("--apply");
const slug = topicArg();
const from = flag("from");
// `--to ""` is a legitimate deletion, so an absent flag is the only error.
const to = flag("to") ?? "";
if (!from) {
  console.error('Missing --from. Usage: --topic <slug> --from "Vehicle:" --to "Scripture:" [--apply]');
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl(PROD));
const res = await client.action(api.backfill.sweepLessonText, {
  secret: publishSecret(),
  topicSlug: slug,
  from,
  to,
  dryRun: !APPLY,
});

console.log(
  `${APPLY ? "APPLIED to" : "DRY RUN against"} ${PROD ? "PROD (live site)" : "dev"} — ` +
    `${slug}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`,
);
console.log(`${res.scanned} live lesson(s) scanned, ${res.changed.length} affected:`);
for (const c of res.changed) console.log(`  ${c.key}  ${c.hits}×`);
// A refusal means that lesson still reads the old way — it must not scroll past.
if (res.refused.length) {
  console.log(`\n!! ${res.refused.length} lesson(s) REFUSED (unreadable body, or the swap moved a quiz marker):`);
  for (const key of res.refused) console.log(`  ${key}`);
}
if (!APPLY && res.changed.length) console.log("\nNothing written. Re-run with --apply to write it.");
