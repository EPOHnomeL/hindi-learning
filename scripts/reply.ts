// Writes Claude Code's Reply to a learner Question and flips the Question to
// answered — the return leg that makes the loop a conversation (CONTEXT.md
// "Reply"). The reader shows the Reply inline with the Question next session.
// Mirrors NeonHubRepository.replyToQuestion. Reads the connection string from
// .env at runtime.
//
// Usage: pnpm run reply <question-id> "<reply text>"
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const id = process.argv[2];
const text = process.argv.slice(3).join(" ").trim();
if (!id || text === "") {
  console.error('Usage: pnpm run reply <question-id> "<reply text>"');
  process.exit(1);
}

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_TEST (or DATABASE_URL) in .env.");
  process.exit(1);
}
const sql = neon(url);

const rows = await sql`select state from questions where id = ${id}`;
const question = rows[0];
if (question === undefined) {
  console.error(`No Question with id '${id}'. Run \`pnpm run review\` to list open questions.`);
  process.exit(1);
}
if (question.state === "answered") {
  console.error(`Question '${id}' is already answered.`);
  process.exit(1);
}

await sql`insert into replies (question_id, text) values (${id}, ${text})`;
await sql`update questions set state = 'answered' where id = ${id}`;
console.log(`replied to ${id} and marked it answered.`);
