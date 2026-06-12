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

A single cloud Claude Code **Routine** on claude.ai authors the next lesson. It
has **only an API trigger** — it does not run itself on a schedule. Two callers
fire it through one Convex gate (`routine.fireIfReady`): a **daily Convex cron**
and the **reader's "Generate next lesson" button**. The gate authors a lesson
only when the **Frontier** (highest-seq, non-superseded lesson) is `completed`,
guarded by a single-flight lock. The agent does the teaching, publishes to prod
Convex, commits straight to `main`, and reports its outcome back to release the
lock.

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

The routine's prompt is the source of truth for *what the agent does each run*.
Keep this repo copy and the claude.ai Instructions field in sync — if they drift,
this file wins and should be re-pasted. The loop is:

1. `pnpm run review:prod` — read the learner's live state (open questions, quiz responses, progress).
2. `pnpm run reply:prod <question-id> "<answer>"` — answer **every** open question, grounded in the handbook/resources.
3. Decide the next lesson from the ZPD evidence. If a lesson is opened-but-incomplete or has wrong answers, reinforce/correct rather than racing ahead. If there's nothing to add, skip to step 7 and report `nothing`.
4. Author **exactly one** lesson per `.agents/skills/teach/SKILL.md` (immutable lesson HTML, updated references/glossary, a new learning record).
5. `pnpm run publish:prod` — publish to the live site.
6. **Commit and push directly to `main`** — no branch, no PR (see §3 permissions). A push to `main` triggers the production deploy (§5).
7. `pnpm run report:prod <published|nothing|failed> hindi ["error"]` — **always**, even on failure, to release the lock.

The full prompt text is maintained alongside this runbook; if it needs editing,
re-derive from `.agents/skills/teach/SKILL.md` and the steps above.

### Cloud environment

- **Setup script:** `corepack enable` + `pnpm install --frozen-lockfile` + `python3 -m pip install pymupdf` (pymupdf renders `Handbook.pdf` pages for grounding).
- **Env vars (set in the routine's cloud env):** `PUBLISH_SECRET`, `CONVEX_PROD_URL`.

---

## 3. Connectors & permissions (claude.ai + GitHub — external)

- **Connector:** account-level **GitHub Integration** (claude.ai → Settings → Connectors). This is what lets the routine clone/read the repo.
- **GitHub App install:** the **Claude GitHub App must be installed on `EPOHnomeL/hindi-learning` with write access.** Verify at GitHub → repo → Settings → GitHub Apps: "Claude" must appear alongside Cloudflare/Vercel. If it's missing, `git push` and branch creation fail with `403 / "Resource not accessible by integration"`.
- **Permissions tab → git push:** **"Allow unrestricted git push — including the default branch" must be ON.** This is what authorizes the step-6 `git push origin HEAD:main`.
- **Behavior tab → "Auto-fix pull requests":** irrelevant once pushing direct to `main`; can be off. (If a harness version still forces a PR despite step 6, enable GitHub → repo → Settings → General → **Allow auto-merge** so PRs merge without manual approval.)

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
- **Empty body** — custom fields (e.g. `topicSlug`) are rejected, so the topic (`hindi`) is fixed in the routine's instructions, not passed in.

**Convex deployment env vars (prod — `npx convex env set --prod`):**
`ROUTINE_FIRE_URL`, `ROUTINE_FIRE_TOKEN`, `PUBLISH_SECRET`, `AUTH_ALLOWED_EMAILS`.

> ⚠️ **Manual/`curl` fires bypass the Convex gate** (they hit the Fire URL directly, skipping `fireIfReady`). The agent then advances on its own judgement and can author past an incomplete Frontier — this is how lessons 5 and 6 were generated while lesson 4 was unfinished. Test the *gated* path via the reader button, not a raw fire.

Backend functions: `convex/routine.ts` (`fireIfReady`, `requestNextLesson`, `dailyFire`, `tryAcquireGeneration`, `reportGeneration`, `failGeneration`, `generationStatus`).

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
| `pnpm run review:prod` | Print live open questions + per-lesson responses/progress. |
| `pnpm run reply:prod <id> "<answer>"` | Answer an open question (shows inline in the reader). |
| `pnpm run publish:prod` | Push `lessons/` + `references/` to prod Convex (idempotent; lessons insert-once, references upsert on change). |
| `pnpm run report:prod <outcome> [topic] ["err"]` | Release the generation lock (`published`/`nothing`/`failed`). |

**Source of truth:** lessons/references publish to Convex **independently of git**
(ADR 0002). The git push only keeps the repo in sync with what's live. If the
push fails but publish succeeded, the live site is ahead of `main` (drift) — the
next run clones a stale tree. This happened once: lesson 5 went live but its
commit was stranded in a reclaimed container; it was recovered from a prod
snapshot. Always ensure step 6 succeeds.

---

## 7. Known failure modes (and the fix)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `git push` → `403 Permission denied` / `Resource not accessible by integration` | Claude GitHub App not installed on the repo (or no write) | Install/authorize it with write access (§3); confirm it shows under repo Settings → GitHub Apps. |
| Preview build → `no Convex deployment configuration found … Set CONVEX_DEPLOY_KEY` | `CONVEX_DEPLOY_KEY` missing for the **Preview** env | Add a preview/dev deploy key to Preview scope (§5). |
| Build → `Detected a non-production build environment and CONVEX_DEPLOY_KEY for a production Convex deployment` | A **production** key set on the **Preview** env | Replace it with a preview/dev key (§5). |
| `review:/publish:prod` errors in the cloud | trailing slash on `CONVEX_PROD_URL` (ConvexHttpClient rejects it) | `scripts/_env.ts` strips trailing slashes; ensure the var is the bare `https://<name>.convex.cloud`. |
| Fire returns an error | missing `anthropic-version` header, bad token, or a non-empty body | Fire with the header + Bearer token + empty body (§4). |
| Lesson generated ahead of the learner | a manual/`curl` fire bypassed the gate | Fire via the reader button (gated), not a raw fire (§4). |
