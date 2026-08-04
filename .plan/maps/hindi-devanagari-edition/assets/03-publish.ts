// Stand up the `hi` (Devanagari) Edition of prophetic-school on PROD from the
// converted files on disk. One-shot admin script (hindi-devanagari-edition/03).
//
//   pnpm tsx topics/_devanagari/publish.ts --dry
//   pnpm tsx topics/_devanagari/publish.ts --go
//
// Order matters and is not arbitrary:
//   1. cloneEdition hi-Latn -> hi. This is the ONLY way to get the `translationJobs`
//      row that publishTranslation requires (it returns "skipped" without one), and
//      it also copies shares/pendingShares. So between step 1 and the end of step 2
//      a shared viewer sees a `hi` Edition holding ROMANIZED text. Accepted
//      deliberately (2026-08-04) rather than deleting and recreating real viewer
//      access rows, which would leave access missing if this crashed mid-run.
//   2. publishTranslation per item. db.replace, so every field must be re-sent or it
//      is DROPPED — that is why `title` is sent for all 57 html rows even though only
//      `html` changed in the conversion. It also re-stamps sourceHash from the CURRENT
//      English source, so these rows read as fresh and a later re-translate skips
//      them, which is what we want: a re-translate would overwrite the conversion.
//   3. reportTranslation ready.
//
// Idempotent: re-running skips unchanged rows (publishTranslation compares and
// returns "unchanged"), and step 1 is skipped when `hi` already has rows. Teardown is
// `removeEdition`, which needs OWNER auth, not this secret — so a rollback happens in
// the app as the signed-in owner, not from here.
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { convexUrl, publishSecret } from "../../scripts/_env";

const GO = process.argv.includes("--go");
const TOPIC = "prophetic-school";
// The email of the user who OWNS prophetic-school in prod. Two wrong guesses cost a
// round-trip each here, so it is written down: it is NOT the email of whoever runs the
// script, and it is NOT `ownerEmail()`/`OWNER_EMAIL` from .env.local — that belongs to
// a different Topic. `cloneEdition` resolves by slug alone and so does not care, but
// `publishTranslation` calls getOwnedTopic(owner._id, slug) and throws "topic not
// found" when the owner doesn't match. Convex REDACTS thrown Error messages in
// production, so that surfaces only as an opaque "Server Error" — the real message is
// in `npx convex logs --prod` (and CONVEX_DEPLOY_KEY must be blanked for that command,
// or the CLI silently reads the dev deployment instead).
// Verified 2026-08-04 against the prod `topics`/`users` tables.
const OWNER = process.env.DEVANAGARI_OWNER_EMAIL ?? "ywampotchtpm@gmail.com";
const DIR = "topics/_devanagari";

type Row = { id: string; kind: "lesson" | "reference" | "mission" | "title" | "question"; key: string; title?: string; hasHtml: boolean; text?: string; reply?: string };
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, "utf8")) as Row[];
const titles = JSON.parse(readFileSync(`${DIR}/converted/row-titles.json`, "utf8")) as Record<string, string>;
const tm = JSON.parse(readFileSync(`${DIR}/converted/title-mission.json`, "utf8")) as { title: string; mission: string };

const client = new ConvexHttpClient(convexUrl(true));
const secret = publishSecret();

// What each row will carry after publish. Built before any write so a dry run shows
// exactly what a real run would send.
const planned = manifest.map((r) => {
  if (r.kind === "title") return { r, args: { text: tm.title } };
  if (r.kind === "mission") return { r, args: { text: tm.mission } };
  // The restored/ file is the swapBackStatic round-trip — the FULL document. The
  // converted/ file still holds `⟦N⟧` placeholders where the static blocks were, and
  // publishing that would ship a lesson with its head chrome and scripts missing.
  const html = readFileSync(`${DIR}/restored/${r.id}.html`, "utf8");
  if (html.includes("⟦")) throw new Error(`${r.id}: placeholders survived into restored/ — refusing to publish`);
  const title = titles[r.key];
  if (!title) throw new Error(`${r.id}: no converted title for key ${JSON.stringify(r.key)}`);
  return { r, args: { html, title } };
});

console.log(`${planned.length} rows planned (${planned.filter((p) => "html" in p.args).length} with html)`);
if (!GO) {
  for (const { r, args } of planned) {
    const size = "html" in args ? `${(args.html as string).length} chars html` : `${(args.text as string).length} chars text`;
    console.log(`  ${r.kind.padEnd(9)} ${(r.key || "—").padEnd(34)} ${size}${"title" in args ? ` | title: ${args.title}` : ""}`);
  }
  console.log("\nDRY RUN — nothing written. Re-run with --go to publish to PROD.");
  process.exit(0);
}

const before = await client.query(api.translate.readEditionBodies, { secret, topicSlug: TOPIC, lang: "hi" });
if (before === null) throw new Error("topic not found on prod");
if (before.length === 0) {
  const res = await client.mutation(api.translate.cloneEdition, { secret, topicSlug: TOPIC, fromLang: "hi-Latn", toLang: "hi" });
  console.log(`cloned: ${res.translations} rows, ${res.shares} shares, ${res.pendingShares} pending shares`);
} else {
  console.log(`hi already has ${before.length} rows — skipping clone, resuming publish`);
}

const tally: Record<string, number> = {};
for (const { r, args } of planned) {
  const res = await client.mutation(api.translate.publishTranslation, {
    secret, ownerEmail: OWNER, topicSlug: TOPIC, lang: "hi", kind: r.kind, key: r.key, ...args,
  });
  tally[res.status] = (tally[res.status] ?? 0) + 1;
  // "skipped" is the one that must never pass unnoticed: it means the quiz-structure
  // guard rejected the body, or the source row vanished, and the reader silently falls
  // back to ENGLISH for that item.
  if (res.status === "skipped") console.log(`  SKIPPED ${r.kind} ${r.key}`);
}
console.log(`publish: ${JSON.stringify(tally)}`);

if (tally.skipped) {
  console.log(`\n${tally.skipped} item(s) skipped — NOT reporting ready. Investigate before the Edition goes live.`);
  process.exit(1);
}
await client.mutation(api.translate.reportTranslation, { secret, topicSlug: TOPIC, lang: "hi", outcome: "ready" });
console.log("reported ready");
