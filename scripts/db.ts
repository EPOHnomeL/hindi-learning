// Resolves which Neon branch a script targets (branch map in docs/deploy.md):
//
//   resolveDbUrl()              → DATABASE_URL_DEV  — the dev branch, the one the
//                                 local worker (.dev.vars) reads. Local-loop default.
//   resolveDbUrl({ prod: true}) → DATABASE_URL      — the production branch.
//
// DATABASE_URL_TEST is reserved for the contract tests, which TRUNCATE tables —
// no script defaults to it (only `pnpm migrate` targets it, explicitly, so the
// suite has schema). There is deliberately no dev→prod fallback: a missing var
// fails loudly rather than letting a local-loop script touch production.
import "dotenv/config";

export function resolveDbUrl(opts: { prod?: boolean } = {}): string {
  const url = opts.prod ? process.env.DATABASE_URL : process.env.DATABASE_URL_DEV;
  if (!url) {
    console.error(
      opts.prod
        ? "Set DATABASE_URL in .env (production branch)."
        : "Set DATABASE_URL_DEV in .env (the dev branch the local worker uses).",
    );
    process.exit(1);
  }
  return url;
}
