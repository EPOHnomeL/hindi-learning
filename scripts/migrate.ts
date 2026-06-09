// Applies migrations/*.sql to a Neon database. Reads the connection string
// from .env at runtime (never printed, never committed). Targets the test
// branch if DATABASE_URL_TEST is set, else DATABASE_URL.
//
//   pnpm migrate            # migrate whichever URL is present (test preferred)
//   pnpm migrate --prod     # force DATABASE_URL (production branch)
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const forceProd = process.argv.includes("--prod");
const url = forceProd
  ? process.env.DATABASE_URL
  : (process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL);

if (!url) {
  console.error("No connection string. Set DATABASE_URL_TEST or DATABASE_URL in .env.");
  process.exit(1);
}

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = neon(url);

for (const file of files) {
  const ddl = readFileSync(dir + file, "utf8");
  const statements = ddl
    .replace(/--.*$/gm, "") // strip line comments first (they may contain ';')
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log(`applied ${file} (${statements.length} statements)`);
}
console.log(`migration complete${forceProd ? " (production)" : ""}.`);
