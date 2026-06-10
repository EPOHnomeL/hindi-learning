// Applies migrations/*.sql to a Neon database. Reads the connection string
// from .env at runtime (never printed, never committed). Statements are
// idempotent (`create table if not exists`), so re-running is safe.
//
//   pnpm migrate            # the TEST branch (DATABASE_URL_TEST) — for the contract tests
//   pnpm migrate --dev      # the dev branch (DATABASE_URL_DEV) — the local worker's Hub
//   pnpm migrate --prod     # the production branch (DATABASE_URL)
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { resolveDbUrl } from "./db.ts";

const target = process.argv.includes("--prod")
  ? "production"
  : process.argv.includes("--dev")
    ? "dev"
    : "test";
const url =
  target === "test" ? process.env.DATABASE_URL_TEST : resolveDbUrl({ prod: target === "production" });

if (!url) {
  console.error("No connection string. Set DATABASE_URL_TEST in .env.");
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
console.log(`migration complete (${target}).`);
