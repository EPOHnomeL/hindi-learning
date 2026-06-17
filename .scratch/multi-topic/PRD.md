# PRD: Multi-topic dashboard — "teach me anything" (whitelisted multi-user)

Status: ready-for-agent

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md). Decisions follow
> [ADR 0009](../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md)
> (content source of truth in Convex; Routine pulls context) and
> [ADR 0010](../../docs/adr/0010-teaching-compute-swappable-adapter.md)
> (swappable teaching compute). Supersedes the placeholder
> [issues/01](issues/01-multi-topic-teach-anything.md), which seeded the scope.

## Problem statement

Today the app teaches exactly one **Topic** (`hindi`), hardcoded across the
reader, the content queries, and the CLI, and grounded in resources committed to
the git repo (`Handbook.pdf`, `lessons/`). A learner cannot start a new subject,
switch between subjects, or feed in their own **Resources** without an engineer
editing files in the repo and a single cloud **Routine** whose instructions fix
it to Hindi.

I want a small group (≈4 whitelisted people, real register→login) to each start
their own Topics from a **dashboard**, upload Resources, switch between Topics,
and have a single shared cloud Routine — running on my Claude subscription,
throttled by the daily schedule — author each Topic's Lessons. That means the
data must leave the repo (it can't hold N users' PDFs) and the Routine must learn
which Topic to teach at run time.

## Solution

A multi-tenant **topic dashboard** on the existing Next.js + Convex app. Convex
becomes the source of truth for all content (Topics, Lessons, References,
**Resources**, capture); the repo holds only code and the teach skill. A learner
**Seeds** a Topic (title + "why" + uploaded Resources) in the dashboard; the
shared Routine **claims** that Topic on its next run, materialises its context
from Convex into an ephemeral workspace, drafts a **Mission**, authors Lessons,
and publishes back. The reader gains a Topic switcher and a Mission view. Each
row is owned by its learner; isolation is enforced by Convex scoping, so the one
operator-run Routine needs no per-user credentials.

No LLM runs in the web app (ADR 0001 holds): seeding and Mission editing are
plain forms; all teaching intelligence stays in the Routine.

## User stories

### Dashboard & navigation
1. As a learner, I register/sign in (only if my email is whitelisted) and see **my** Topics — none of anyone else's.
2. As a learner, I start a new Topic from the dashboard by giving it a title, a free-text "why", and one or more Resources (**Seed**).
3. As a learner, I switch between my Topics; the reader shows the active Topic's Lessons, References, and Mission.
4. As a learner, I read a Topic's Mission and can edit its text.
5. As a learner, I upload an additional Resource to an existing Topic at any time.
6. As a learner, my progress, responses, and questions are scoped to the Topic I'm in (no collision across Topics that both start at `0001-`).

### Authoring (Routine as actor)
7. As the Routine, on each run I claim one ready Topic and materialise its Mission, Resources (raw + cached-processed), prior Lessons, learning records, and Topic-scoped capture into a workspace.
8. As the Routine, for a Seeded Topic with no Lessons I draft a Mission from the Seed + Resources and author the first Lesson.
9. As the Routine, I publish Lessons/References/Mission/processed-Resources back to Convex and report my outcome — I never commit content to `git`.
10. As the operator, the daily schedule fires every ready Topic (fire-all), each as its own fresh run claiming a distinct locked Topic.

### Operational
11. As the operator, I bound exposure with `AUTH_ALLOWED_EMAILS` (the 4 users) and by gating the on-demand "Generate next lesson" button so authoring can't spike.
12. As the operator, the existing Hindi content + my capture history migrate onto the new model under a `hindi` Topic I own (not reset), and `Handbook.pdf` moves out of `git` into Convex file storage.

## Implementation decisions

- **Convex is the source of truth** (ADR 0009). Repo = code + teach skill only.
- **Routine pulls + claims at run time** (ADR 0009): gate locks one ready Topic before firing; the run claims it atomically (`claimedAt`/`runId`); stale locks re-fire. The Routine is topic-agnostic.
- **Compute is a swappable adapter** (ADR 0010): shared claude.ai Routine now; per-owner Agent-SDK workers later. No rebuild of the Convex control plane to switch.
- **Resources are hybrid-ingested**: raw blob in Convex file storage; processed artifacts rendered lazily by the agent on first need and cached back, keyed by `contentHash`.
- **Mission = Seed → Routine draft → learner edits**; stored in Convex, round-trips into `MISSION.md` at materialise time.
- **Per-run ephemeral workspace** `topics/<slug>/` — this is the "modularise the teach session per Topic" ask; the skill runs against a target dir, not a fixed root.

## Schema deltas (Convex)

- `topics`: add `ownerId` (`users`), `mission` (optional string), `seed` (optional string), `status` (`seeded | active`), optional `seq` for switcher order.
- `resources` (new): `topicId`, `ownerId`, `filename`, `rawStorageId`, `processed` (manifest of storageIds / extracted text refs), `contentHash`, `status` (`raw | processing | ready`), `kind`.
- `responses` / `progress` / `questions`: add `topicId`; new indexes leading with `topicId` (and `userId`); migrate existing rows to the `hindi` Topic (widen → backfill → narrow, `@convex-dev/migrations`).
- `generation`: add `claimedAt` / `runId` for atomic per-run claim; keep the per-Topic lock + stale recovery.

## Out of scope

- **Agent-SDK / own-compute authoring** — deferred to Phase 2 (ADR 0010). Phase 1 is the shared Routine.
- **Per-user billing / BYO Claude key** — operator funds Phase 1; whitelist bounds it.
- **Public signup / open registration / roles / teams** — whitelist only.
- **LLM in the web app** — seeding and Mission editing are plain forms (ADR 0001).
- **In-place Lesson editing** — immutable / supersede only (ADR 0003).
- **Real-time push/email notifications** — `answered` state shows on next visit.
