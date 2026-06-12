# 01 — Multi-topic: "teach me anything" (single user)

Status: needs-info

> TODO / placeholder. To be scoped properly later with `grill-with-docs`. This
> just captures the intent and what was already found, so the scoping session
> has a seed. Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md).

## Want

Learn **anything** in this app — start a new **Topic** (a language, cooking, a
codebase), give the teach skill resources for it, and read its lessons in the
same reader. Each Topic has its own mission, lessons, references, and capture
history. **Single user** — one account, many Topics; no multi-user / ownership
/ signup work (deferred).

## Decided so far

- Workspace layout: each Topic is a self-contained folder `topics/<slug>/`
  (its own `MISSION.md`, `lessons/`, `references/`, `learning-records/`, …).
  Existing Hindi files migrate into `topics/hindi/`. (Rejected: one repo per
  Topic.)
- Scope is single-user. Topics stay global to the one account.

## What's hardcoded to one Topic today (the work)

- `convex/content.ts`: `TOPIC_SLUG = "hindi"` — every content query resolves the
  one "hindi" Topic. Needs a `topicSlug` param + a `listTopics` query.
- `scripts/publish.ts`: `ensureTopic({ title: "Hindi" })` baked in; reads
  root-level `lessons/` & `references/`. Needs `--topic <slug>` reading from
  `topics/<slug>/`. Same for `review.ts` / `reply.ts`.
- **Capture collision (important):** `responses` / `progress` / `questions` are
  keyed by `(userId, lessonKey)` only. Every Topic's lessons start at `0001-…`,
  so a second Topic's `0001-` collides with Hindi's. Need `topicId` on every
  capture row + indexes that lead with it, plus a data migration (widen →
  backfill existing rows to the `hindi` Topic → narrow). See the
  `convex-migration-helper` skill.
- Reader (`src/app/_components/Reader.tsx`): hardcoded "Hindi" header, no Topic
  switcher. Needs a switcher + show the active Topic's mission, and thread
  `topicSlug` through all queries/mutations.
- Teach skill docs (`.agents/skills/teach/SKILL.md` + the `.claude` copy):
  document the per-Topic folder model and `--topic` flag.

## Must not break

- Existing Hindi lessons/references **and** the learner's capture history are
  preserved (migrated under `hindi`, not reset).
- With one Topic, the reader behaves as today.

## Open questions for scoping

- Where does Topic `title` / `mission` come from on publish — `MISSION.md`
  (first heading + paragraph) or a small `topic.json`?
- Topic ordering in the switcher (alphabetical vs explicit `seq`).
- Should the reader ever create a Topic, or are Topics always born in the teach
  workspace (current "no authoring in the web app" stance)?
