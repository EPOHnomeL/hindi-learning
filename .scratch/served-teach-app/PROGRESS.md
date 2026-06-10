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

- **Publish shell** — `scripts/publish.ts` wraps the pure planner (`src/publish/plan.ts`): scans `lessons/` + `references/`, diffs against the Hub, and pushes new/changed artifacts (`wrangler r2 object put` for blobs + Neon writes for metadata). Idempotent. Authoring is now `pnpm run publish` — a new lesson file appears on the site with no hand-seeding. `seed.ts` only resets the dev identity (user + topic). Convention (see the publish header): filename stem = id, `<title>` after " · " = display title, optional `<meta name="supersedes">` for replacements.

### Local dev today
Setup: `pnpm seed` (reset identity) then `pnpm run publish` (publish the workspace). Run: two servers (HMR) `pnpm dev` (Worker/API, 8787) + `pnpm client` (reader, 5173, LAN-bound); or single origin `pnpm build` + `pnpm dev`.

- **Conversation loop (teach side)** — `pnpm run review` reads open Questions + Responses/Progress from the Hub; `pnpm run reply <id> "…"` answers a Question. The teach skill (`.claude/skills/teach/SKILL.md`) documents both, plus publishing and the authoring conventions, so it knows the app is a two-way channel.

- **Reader go-live fixes** — Progress now persists across reloads (GET `/api/topics/:id/progress` + hydrate on load); the device Back button moves between panes instead of leaving the app (panes pushed to history).

## Remaining (go-live)

- **Auth (HITL)** — the app is ungated and `currentUserId` is a `dev-user` stub. Decide v1 auth: Cloudflare Access (gate to your email — ADR-0004) and/or Neon Auth (in-app login — ADR-0006), then wire it into `src/worker/index.ts`.
- **Cloud deploy (HITL)** — Cloudflare account + Workers project + a private R2 bucket (`served-teach-artifacts`) with real ids in `wrangler.toml`; `DATABASE_URL` via `wrangler secret put`; then `pnpm build && pnpm run deploy` and `pnpm run publish -- --remote`.
- **MCPs (HITL)** — no `.mcp.json` yet. Connect at least the Neon MCP (manage the Hub from Claude Code, per ADR-0002) and any others wanted (e.g. Cloudflare).
- **⚠️ Separate the test DB branch** — `DATABASE_URL_TEST` (.env) points at the SAME Neon branch as the dev worker (`.dev.vars` `DATABASE_URL` → `ep-orange-frost`). The Neon contract tests truncate tables, so running `pnpm test` **wipes dev data** (lessons/progress/questions). Point `DATABASE_URL_TEST` at a dedicated test branch before running tests against anything you care about.

## Open threads
- `/to-issues` produced a 9-slice breakdown but it was **not approved/published** — we jumped to `/tdd`. The slices map onto the Remaining items above when you want them filed.
