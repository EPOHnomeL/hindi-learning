// Reads the learner's side of the conversation from the Hub at the start of a
// teach session (ADR-0001): the open Questions waiting for a Reply, plus the
// Responses and Progress per lesson that reveal what has been mastered and where
// the learner is stuck. Read-only. Answer questions with `pnpm run reply`.
// Reads the connection string from .env at runtime.
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const TOPIC_ID = "hindi"; // v1 has one Topic; CONTEXT.md.
const USER_ID = "dev-user"; // dev stub until Neon Auth (ADR-0006).

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_TEST (or DATABASE_URL) in .env.");
  process.exit(1);
}
const sql = neon(url);

const lessons = await sql`select id, seq, title from lessons
  where topic_id = ${TOPIC_ID} and superseded_by is null order by seq`;
const openQuestions = await sql`select q.id, q.lesson_id, q.text from questions q
  join lessons l on l.id = q.lesson_id
  where l.topic_id = ${TOPIC_ID} and q.state = 'open' order by q.created_at`;

console.log(`\n# Learner review — topic '${TOPIC_ID}'\n`);

console.log(`## Open questions (${openQuestions.length}) — answer with: pnpm run reply <id> "<reply>"`);
if (openQuestions.length === 0) console.log("  (none)");
for (const q of openQuestions) console.log(`  • [${q.id}]  (in ${q.lesson_id})\n      ${q.text}`);

console.log(`\n## Progress & responses by lesson`);
for (const l of lessons) {
  const prog = await sql`select state from progress where user_id = ${USER_ID} and lesson_id = ${l.id}`;
  const state = prog[0]?.state ?? "unseen";
  const responses = await sql`select prompt_id, value, correctness from responses
    where lesson_id = ${l.id} order by created_at`;
  const correct = responses.filter((r) => r.correctness === true).length;
  const score = responses.length ? `${correct}/${responses.length} correct` : "no answers";
  console.log(`\n  ${String(l.seq).padStart(2, "0")} · ${l.title}`);
  console.log(`      progress: ${state} · ${score}`);
  for (const r of responses) {
    console.log(`        - ${r.prompt_id}: ${r.correctness ? "✓" : "✗"} "${r.value}"`);
  }
}
console.log("");
