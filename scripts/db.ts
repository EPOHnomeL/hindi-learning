// Resolves which Neon branch a script targets (branch map in docs/deploy.md):
//
//   resolveDbUrl("dev")   → DATABASE_URL_DEV  — the dev branch, the one the local
//                           worker (.dev.vars) reads. Local-loop default.
//   resolveDbUrl("test")  → DATABASE_URL_TEST — reserved for the contract tests,
//                           which TRUNCATE tables; only `pnpm migrate` targets it.
//   resolveDbUrl("prod")  → DATABASE_URL      — the production branch.
//
// There is deliberately no fallback between targets: a missing var fails loudly
// rather than letting a local-loop script touch production.
import "dotenv/config";

export type DbTarget = "dev" | "test" | "prod";

const VAR: Record<DbTarget, string> = {
  dev: "DATABASE_URL_DEV",
  test: "DATABASE_URL_TEST",
  prod: "DATABASE_URL",
};

export function resolveDbUrl(target: DbTarget): string {
  const url = process.env[VAR[target]];
  if (!url) {
    console.error(`Set ${VAR[target]} in .env (the ${target} branch).`);
    process.exit(1);
  }
  return url;
}
