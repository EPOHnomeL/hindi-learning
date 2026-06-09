# Progress — Served Teach App

Status: in-progress (pure core complete; transport + infra blocked on slice 0)

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

## Blocked on slice 0 (HITL — needs your accounts + decisions)

Nothing below can be built/verified without real infrastructure:

- **Neon adapter** — a real `HubRepository` implementation. *Must satisfy the existing contract tests in `src/hub/repository.test.ts`* (run them against a Neon test branch).
- **Artifact store adapter (R2)** — `get`/`put` over the R2 binding; private bucket served only through the worker (ADR-0005).
- **Hono worker routes** — thin glue: serve Lesson/Reference HTML via the R2 binding behind Cloudflare Access; `POST` capture → `CaptureService`; `GET` topics/lessons/threads → repository.
- **Vite reader UI** — topic list, lesson view (renders served HTML + mounts capture widgets), reference view, question/reply thread, progress.
- **Publish execution shell** — wraps the pure Publish planner: `wrangler r2 object put` for blobs + Neon writes for metadata.

### What I need from you to unblock
1. Cloudflare account + a Workers/Pages project, an R2 bucket (private), and a `wrangler.toml` with real ids.
2. A Neon database + a test branch, connection string available to the worker and to tests.
3. The Cloudflare Access policy decision (gate the app to which identity/identities — ADR-0004).

## Open threads
- `/to-issues` produced a 9-slice breakdown (slice 0 HITL, the rest AFK) but it was **not approved/published** — we jumped to `/tdd`. The slices map cleanly onto the work above when you want them filed.
