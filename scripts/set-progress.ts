// Place a reader at a lesson they reached outside the reader.
//
//   pnpm tsx scripts/set-progress.ts --topic <slug> --email <who> --through 22 --at 23 [--prod] [--go]
//
// `--through N` marks lessons 1..N completed, `--at M` marks lesson M opened, and
// the reader lands on M because entries are stamped in order (see setProgressFor).
// Either may be given alone. Dry run unless --go.
//
// This exists for the translator/reviewer case: someone works through a course in a
// spreadsheet rather than by clicking Next, and would otherwise have to re-open
// twenty-odd lessons by hand to stop the course telling them they are on lesson 1.
// It never downgrades a completed lesson, so it cannot erase a reader's own record.
//
// Lesson keys are read from the Topic's own Edition rows rather than typed out, so
// the numbering always matches the course. Progress is per-TOPIC, not per-Edition
// (CONTEXT.md), so --lang only picks which Edition to enumerate keys from.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret, topicArg } from "./_env";

const PROD = process.argv.includes("--prod");
const GO = process.argv.includes("--go");
const slug = topicArg();

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
}

const email = flag("--email");
if (!email) {
  console.error("Missing --email <address> (the reader's registered email).");
  process.exit(1);
}
const through = flag("--through") ? Number(flag("--through")) : undefined;
const at = flag("--at") ? Number(flag("--at")) : undefined;
if (through === undefined && at === undefined) {
  console.error("Give --through <N> (mark 1..N completed) and/or --at <M> (mark M opened).");
  process.exit(1);
}
const lang = flag("--lang") ?? "en";

const client = new ConvexHttpClient(convexUrl(PROD));
const secret = publishSecret();

// Enumerate the real lesson keys. The English source has no translations rows, so
// fall back to asking for a translated Edition when --lang is left at the default.
const rows = await client.query(api.translate.readEditionBodies, { secret, topicSlug: slug, lang });
if (!rows || rows.length === 0) {
  console.error(
    `No rows to read lesson keys from for ${slug}/${lang}.\n` +
      "Pass --lang <code> naming an Edition this Topic actually has.",
  );
  process.exit(1);
}
const keys = rows
  .filter((r) => r.kind === "lesson")
  .map((r) => r.key)
  .sort();
console.log(`${keys.length} lessons in ${slug} (keys read from the ${lang} Edition)`);

const nth = (n: number): string => {
  const k = keys[n - 1];
  if (!k) throw new Error(`this course has no lesson ${n} (it has ${keys.length})`);
  return k;
};

// Order matters: the LAST entry is stamped newest and is where the reader lands.
const entries: { lessonKey: string; status: "opened" | "completed" }[] = [];
if (through !== undefined) for (let n = 1; n <= through; n++) entries.push({ lessonKey: nth(n), status: "completed" });
if (at !== undefined) entries.push({ lessonKey: nth(at), status: "opened" });

const before = await client.query(api.capture.readProgressFor, { secret, email, topicSlug: slug });
if (before === null) {
  console.error(`No registered user "${email}", or no Topic "${slug}". Nothing written.`);
  process.exit(1);
}
const wasDone = before.filter((r) => r.status === "completed").length;
const wasLast = [...before].sort((a, b) => (a.lastReadAt ?? 0) - (b.lastReadAt ?? 0)).at(-1);
console.log(`before: ${before.length} rows, ${wasDone} completed, last read ${wasLast?.lessonKey ?? "(none)"}`);
console.log(`plan:   ${entries.length} entries, landing on ${entries.at(-1)!.lessonKey}`);

if (!GO) {
  for (const e of entries) console.log(`  ${e.status.padEnd(9)} ${e.lessonKey}`);
  console.log("\nDRY RUN. Nothing written. Re-run with --go.");
  process.exit(0);
}

const res = await client.mutation(api.capture.setProgressFor, { secret, email, topicSlug: slug, entries });
console.log(`wrote: ${JSON.stringify(res)}`);

const after = await client.query(api.capture.readProgressFor, { secret, email, topicSlug: slug });
const done = after!.filter((r) => r.status === "completed").length;
const last = [...after!].sort((a, b) => (a.lastReadAt ?? 0) - (b.lastReadAt ?? 0)).at(-1);
console.log(`after:  ${after!.length} rows, ${done} completed, resume point ${last?.lessonKey}`);
