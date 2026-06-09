import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { beforeAll, describe, it } from "vitest";
import { runHubContract } from "./hubContract.js";
import { NeonHubRepository, resetNeonHub } from "./neonRepository.js";

// Runs the SAME Hub contract against a real Neon database. Skips entirely until
// DATABASE_URL_TEST is set in .env (loaded by vitest.setup.ts), so the suite
// stays green before slice-0 infra exists.
const url = process.env.DATABASE_URL_TEST;

if (!url) {
  describe.skip("HubRepository contract — neon (set DATABASE_URL_TEST to run)", () => {
    it("skipped until a Neon test branch is configured", () => {});
  });
} else {
  const sql = neon(url);

  beforeAll(async () => {
    const ddl = readFileSync(
      fileURLToPath(new URL("../../migrations/0001_init.sql", import.meta.url)),
      "utf8",
    );
    const statements = ddl
      .split(";")
      .map((s) => s.replace(/--.*$/gm, "").trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) {
      await sql.query(statement);
    }
  });

  runHubContract("neon", async () => {
    await resetNeonHub(sql);
    return new NeonHubRepository(sql);
  });
}
