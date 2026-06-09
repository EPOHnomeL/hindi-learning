// Seeds the Neon TEST branch with a sample Hindi topic for local dev so the
// reader has something to show. Pairs with the HTML blobs in seed/, which get
// uploaded to local R2 via wrangler (see README/commands). Reads the connection
// string from .env at runtime. Idempotent: it truncates first.
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_TEST (or DATABASE_URL) in .env.");
  process.exit(1);
}
const sql = neon(url);

const TABLES = ["users", "topics", "lessons", "topic_references", "responses", "questions", "replies", "progress"];
await sql.query(`truncate table ${TABLES.join(", ")}`);

await sql`insert into users (id) values ('dev-user')`;
await sql`insert into topics (id, user_id, title, mission)
  values ('hindi', 'dev-user', 'Hindi — from the Bible',
          'Read the Gospels in Hindi well enough to follow a sermon, grounding every lesson in verses I already know in English.')`;

await sql`insert into lessons (id, topic_id, seq, title, r2_key)
  values ('0001-peace', 'hindi', 1, ${"शान्ति — “Peace be with you”"}, 'lessons/0001-peace.html')`;
await sql`insert into lessons (id, topic_id, seq, title, r2_key)
  values ('0002-light', 'hindi', 2, ${"ज्योति — “the Light”"}, 'lessons/0002-light.html')`;

await sql`insert into topic_references (id, topic_id, title, r2_key, content_hash)
  values ('ref-core-words', 'hindi', 'Core words so far', 'references/ref-core-words.html', 'seed')`;

await sql`insert into questions (id, lesson_id, text, state)
  values ('seed-q1', '0001-peace', ${"Is शान्ति ever used as a person's name?"}, 'open')`;

console.log("seeded: topic 'hindi' (dev-user), 2 lessons, 1 reference, 1 open question.");
