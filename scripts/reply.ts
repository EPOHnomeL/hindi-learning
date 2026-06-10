// Writes Claude Code's Reply to a learner Question and flips the Question to
// answered — the return leg that makes the loop a conversation (CONTEXT.md
// "Reply"). The reader shows the Reply inline with the Question next session.
// Mirrors NeonHubRepository.replyToQuestion. Reads the connection string from
// .env at runtime.
//
// Usage: pnpm run reply [--prod] <question-id> "<reply text>"
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { resolveDbUrl } from "./db.ts";

const prod = process.argv.includes("--prod");
const args = process.argv.slice(2).filter((a) => a !== "--prod");
const id = args[0];
const text = args.slice(1).join(" ").trim();
if (!id || text === "") {
  console.error('Usage: pnpm run reply [--prod] <question-id> "<reply text>"');
  process.exit(1);
}

const sql = neon(resolveDbUrl({ prod }));

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
