# The next-lesson Routine — operational runbook

How the cloud teacher is actually wired: the command it runs, how and when it
fires, the connectors and permissions it needs, and the env/deploy config that
makes it work. This is the **how it's plumbed**; the **why** (gate-in-Convex,
API-only, one routine) is [ADR 0008](adr/0008-next-lesson-routine-gate-in-convex.md),
and the domain terms (**Routine**, **Frontier**) are in [CONTEXT.md](../CONTEXT.md).

> Most of this lives in **external dashboards, not this repo** — claude.ai
> (the routine), GitHub (the app install), Vercel (build + env), and the Convex
> dashboard (deploy keys + deployment env). Sections below say where each lives.
> No secret **values** are recorded here, only the names of the keys/vars.

---

## 1. In one paragraph

A single **topic-agnostic** cloud Claude Code **Routine** on claude.ai authors the
next lesson. It has **only an API trigger** — it does not run itself on a
schedule. Two callers fire it through one Convex gate: a **daily Convex cron**
and the **reader's "Generate next lesson" button**. The gate locks one ready
Topic (whose **Frontier** — highest-seq, non-superseded lesson — is `completed`,
or that is freshly **seeded** with no lessons) under a single-flight lock. The
fired run **claims** that locked Topic (`routine.claimWork`), materialises its
context from Convex into `topics/<slug>/`, does the teaching, **publishes back to
Convex** (the source of truth — ADR 0009), and reports its outcome to release the
lock. It does **not** commit content to git.

---

## 2. The cloud Routine (claude.ai — external)

| Field | Value |
| --- | --- |
| Name | `teacher-next-lesson` |
| Repository | `EPOHnomeL/hindi-learning` |
| Cloud environment | `hindi-learning-prod` |
| Model | Opus 4.8 (1M context) |
| Trigger | **Call via API** only — **no cron on the routine** (the cron lives in Convex; see §4) |

### Instructions (the command it runs)

**The canonical Instructions text lives in [routine-prompt.md](routine-prompt.md)** —
that file is the source of truth for the claude.ai Instructions field. If the
repo copy and the claude.ai field drift, routine-prompt.md wins and should be
re-pasted. The loop, in brief:

1. `SLUG=$(pnpm -s run claim:prod)` — atomically claim one ready Topic (or `none` → end the run).
2. `pnpm run materialise:prod --topic "$SLUG"` — pull the Topic's context into `topics/$SLUG/` and work there.
3. Read `.agents/skills/teach/SKILL.md`; treat `topics/$SLUG/` as its workspace.
4. If only `SEED.md` exists (no `MISSION.md`), draft the Mission from the Seed + Resources.
5. `pnpm run review:prod --topic "$SLUG"` + `pnpm run reply:prod <id> "<answer>"` for every open question.
6. Author **exactly one** lesson into `topics/$SLUG/lessons/` (+ updated references, a new learning record).
7. `pnpm run publish:prod --topic "$SLUG"` — publish mission/lesson/record/refs to Convex. **No git commit** (ADR 0009).
8. `pnpm run report:prod <published|nothing|failed> "$SLUG" ["error"]` — **always**, even on failure, to release the lock.

### Cloud environment

- **Setup script:** `corepack enable` + `pnpm install --frozen-lockfile` + `python3 -m pip install pymupdf` (pymupdf renders `Handbook.pdf` pages for grounding).
- **Env vars (set in the routine's cloud env):** `PUBLISH_SECRET`, `CONVEX_PROD_URL`. `OWNER_EMAIL` is **not** set here — `claim:prod` resolves the claimed Topic's owner and writes it to `.env.local` for the owner-scoped steps, so the run is self-sufficient.

---

## 3. Connectors & permissions (claude.ai + GitHub — external)

- **Connector:** account-level **GitHub Integration** (claude.ai → Settings → Connectors). This is what lets the routine **clone/read** the repo to get the code and the teach skill.
- **GitHub App install:** the **Claude GitHub App must be installed on `EPOHnomeL/hindi-learning`** (read access is enough — it only clones code). Verify at GitHub → repo → Settings → GitHub Apps: "Claude" must appear alongside Cloudflare/Vercel.
- **git push / write access:** **no longer required.** Since ADR 0009, the routine publishes content to Convex and commits nothing — it never pushes to `main`, opens a PR, or creates a branch. (Earlier versions of this runbook required unrestricted push; that is obsolete.)

---

## 4. How and when it fires (timing)

The routine is fired through Convex, never directly on a schedule. Two callers,
one gate:

- **Daily cron** — `convex/crons.ts`: `"23 4 * * *"` = **04:23 UTC daily** → `internal.routine.dailyFire`. Off-peak, arbitrary minute; the button covers immediacy.
- **Reader button** — `routine.requestNextLesson` (auth-gated), fired by the "Generate next lesson →" button that appears on the **completed Frontier** ([ArtifactView.tsx](../src/app/_components/ArtifactView.tsx)).

Both go through `routine.fireIfReady`, which:

- **Gates:** authors only if the Frontier is `completed` (buffer of one).
- **Locks:** a per-Topic single-flight lock (`generation` table) with a ~10-min stale timeout (a run stuck "generating" becomes re-fireable) and a per-Frontier debounce (a run that publishes nothing suppresses the button until the Frontier advances).
- **Fires:** POSTs the routine's Fire URL.

**Fire request shape** (the run API is strict):
- Header `anthropic-version: 2023-06-01`
- `Authorization: Bearer <token>`
- **Empty body** — custom fields (e.g. `topicSlug`) are rejected, so the run is **not told its Topic**. Instead it learns it at run time by calling `routine.claimWork` (via `pnpm run claim:prod`), which hands back one locked-but-unclaimed Topic. This is what makes the single Routine topic-agnostic.

**Convex deployment env vars (prod — `npx convex env set --prod`):**
`ROUTINE_FIRE_URL`, `ROUTINE_FIRE_TOKEN`, `PUBLISH_SECRET`, `AUTH_ALLOWED_EMAILS`.

> ⚠️ **Manual/`curl` fires bypass the Convex gate** (they hit the Fire URL directly, skipping `fireIfReady`). The agent then advances on its own judgement and can author past an incomplete Frontier — this is how lessons 5 and 6 were generated while lesson 4 was unfinished. Test the *gated* path via the reader button, not a raw fire.

Backend functions: `convex/routine.ts` (`requestNextLesson`, `dailyFire`, `tryAcquireGeneration`, `claimWork`, `materialiseTopic`, `reportGeneration`, `failGeneration`, `generationStatus`) and `convex/content.ts` (`ensureTopic`, `publishMission`, `publishLesson`, `publishLearningRecord`, `upsertReference`).

---

## 5. Hosting & deploy (Vercel + Convex — external)

- **Vercel project:** `hindi-learning` (team `jonathan-6428's projects`).
- **Build command:** `npx convex deploy --cmd 'pnpm run build'` — deploys Convex functions **and** builds the Next.js reader; it also injects `NEXT_PUBLIC_CONVEX_URL` for the build, so that var does **not** need to be set by hand.
- **`CONVEX_DEPLOY_KEY` (required, env-scoped in Vercel → Settings → Environment Variables):**
  - **Production** scope → a **production** deploy key (builds from `main` deploy to prod Convex).
  - **Preview** scope → a **preview/dev** deploy key. Do **not** put a production key here — `convex deploy` refuses a production key in a non-production build (`"Detected a non-production build environment and CONVEX_DEPLOY_KEY for a production Convex deployment"`). Preview keys may require a Convex Pro plan; if unavailable, disable Preview deployments (Vercel → Settings → Git) since `main` → Production is all that's needed.
- **Convex deployments:** prod `capable-barracuda-769`, dev `judicious-marmot-580`.

Generate deploy keys in the Convex dashboard → Project Settings → **Deploy Keys**.

---

## 6. Publish, report & source-of-truth

The teach CLI (`scripts/`, wired in `package.json`):

| Command | Does |
| --- | --- |
| `pnpm -s run claim:prod` | Claim one ready Topic for this run; prints its slug (or `none`) and writes its owner to `.env.local` as `OWNER_EMAIL` for the owner-scoped steps. |
| `pnpm run materialise:prod --topic <slug>` | Pull the Topic's Mission/Seed, lessons, learning records, references, resources, and capture into `topics/<slug>/`. |
| `pnpm run review:prod --topic <slug>` | Print live open questions + per-lesson responses/progress. |
| `pnpm run reply:prod <id> "<answer>"` | Answer an open question (shows inline in the reader). |
| `pnpm run publish:prod --topic <slug>` | Push `topics/<slug>/` (mission, lessons, learning records, references) to prod Convex (idempotent; lessons + records insert-once, references upsert on change). |
| `pnpm run report:prod <outcome> <slug> ["err"]` | Release the generation lock (`published`/`nothing`/`failed`). |

**Source of truth:** **Convex** (ADR 0009). Content publishes to Convex and the
Routine commits nothing to git, so the old 0002/0008 drift failure mode — publish
succeeds but the commit is stranded, leaving the live site ahead of `main` — is
**gone**: git no longer carries content, so there is nothing to reconcile. The
`topics/<slug>/` workspace is a transient per-run working copy, not the SoT.

---

## 7. Known failure modes (and the fix)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `claim:prod` prints `none` on every run | No Topic is locked-and-unclaimed: nothing seeded/ready, or the lock is stuck `generating` | Confirm a Topic is seeded or has a completed Frontier; a crashed run's lock self-heals after the 10-min stale window, then re-fires. |
| `materialise:/publish:prod` errors in the cloud | trailing slash on `CONVEX_PROD_URL` (ConvexHttpClient rejects it) | `scripts/_env.ts` strips trailing slashes; ensure the var is the bare `https://<name>.convex.cloud`. |
| `materialise:prod` → "No owned Topic … nothing to materialise" / "Missing OWNER_EMAIL" | the run can't determine the Topic's owner | Normally auto-handled: `claim:prod` resolves the owner from the claimed Topic and writes `OWNER_EMAIL` to `.env.local`. This only surfaces if the Topic has **no owner on record** (legacy/unowned `ownerId`) — back-fill the Topic's owner, or set `OWNER_EMAIL` manually for that run. |
| `publish:prod` → "No workspace at topics/<slug>/" | publish ran before materialise (or for the wrong slug) | Run `materialise:prod --topic <slug>` first; publish reads the materialised workspace, not the repo root. |
| Fire returns an error | missing `anthropic-version` header, bad token, or a non-empty body | Fire with the header + Bearer token + empty body (§4). |
| Lesson generated ahead of the learner | a manual/`curl` fire raced the gate | Fire via the reader button (gated), not a raw fire (§4); a raw fire with no locked Topic now no-ops (`claimWork` returns nothing). |
| Code/schema changes not live | the operator hasn't deployed; the Routine no longer pushes code | Push code to `main` yourself → Vercel build runs `convex deploy` (§5). Content (lessons etc.) needs no deploy — `publish` writes straight to Convex. |
