# Progress — Served Teach App

Status: in-progress (pure core + transport complete; runs locally as a single origin; cloud deploy is the remaining HITL slice)

Snapshot of an AFK build session. Vocabulary per [`CONTEXT.md`](../../CONTEXT.md); decisions per [`docs/adr/`](../../docs/adr/).

## Built and tested (TDD, 43 tests passing, typecheck clean)

All four PRD deep modules plus the inbound seam — all pure / infra-free, each committed separately:

| Module | Path | What it does |
|--------|------|--------------|
| Question lifecycle | `src/domain/question.ts` | `open → answered`, Reply binding, illegal-transition + validation guards |
| Publish planner | `src/publish/plan.ts` | pure `(workspace, hub state) → action plan`; new Lessons insert (immutable), References upsert on change, supersede; idempotent |
| Capture protocol | `src/capture/protocol.ts` | validates untrusted Response/Question/Progress payloads; rejects prompt-less Responses; advance-only Progress |
| Hub repository | `src/hub/repository.ts` | data-access **port** + **in-memory adapter** + contract tests (user scoping, author order, supersede, reply-flips-question, upsert current-wins, advance-only progress) |
| Capture service | `src/capture/service.ts` | inbound seam: validate → persist via the port; injected id generator; verified end-to-end against the in-memory hub |

Reuse worth noting: the repository and service reuse `answerQuestion`/`openQuestion` (domain) and `advanceProgress` (protocol) rather than re-implementing the rules.

## Transport built since (runs locally end-to-end)

- **Neon adapter** — `src/hub/neonRepository.ts`, satisfying the repository contract tests against a Neon test branch.
- **Artifact store adapter (R2)** — `src/hub/artifactStore.ts`; `get`/`put` over the R2 binding, served only through the worker (ADR-0005).
- **Hono worker routes** — `src/worker/app.ts`: serve Lesson/Reference HTML from R2; `GET` topics/lessons/references/questions → repository; `POST` responses/questions/progress → `CaptureService`.
- **Vite reader UI** — `src/client/`: three-pane workstation (Lessons nav + progress · reader · question/reply thread). `LessonFrame` sizes the artifact iframe to its content so it renders fully on mobile, and captures the first answer to each lesson quiz back to the Hub (`POST /api/responses`) by hooking the authored quiz markup in the same-origin iframe — lessons stay pure artifacts.
- **Single origin** — the built reader is served by the Worker via `[assets]` in `wrangler.toml`; `run_worker_first = ["/api/*"]` keeps API requests on the Worker, everything else falls back to the SPA. `pnpm build` then `wrangler dev`/`deploy`. Verified locally: `/`, SPA fallback, `/api/*`, and hashed assets all serve.
- **Real teaching data** — the dev seed (`scripts/seed.ts` + `pnpm seed:r2`) points at the real artifacts (`lessons/*.html`, `references/ref-core-words.html` rendered from `GLOSSARY.md`). All sample blobs and the fabricated seed Question were removed; the conversation starts empty.

### Local dev today
Two servers (HMR): `pnpm dev` (Worker/API, 8787) + `pnpm client` (reader, 5173, LAN-bound). Or single origin: `pnpm build` + `pnpm dev`.

## Remaining

- **Cloud deploy (HITL — needs your accounts + decisions):**
  1. Cloudflare account + Workers project + a private R2 bucket (`served-teach-artifacts`) with real ids in `wrangler.toml`.
  2. A Neon database + test branch; `DATABASE_URL` via `wrangler secret put`.
  3. Cloudflare Access policy — which identity/identities gate the app (ADR-0004), and Neon Auth wiring (ADR-0006) to replace the `dev-user` stub in `src/worker/index.ts`.
- **Publish execution shell** — wraps the pure Publish planner (`src/publish/plan.ts`): `wrangler r2 object put` for blobs + Neon writes for metadata, so authoring no longer hand-runs the seed scripts.

## Open threads
- `/to-issues` produced a 9-slice breakdown but it was **not approved/published** — we jumped to `/tdd`. The slices map onto the Remaining items above when you want them filed.
