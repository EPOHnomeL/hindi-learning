---
slug: publishing-workspace
name: Publishing & Workspace
position: 4
status: draft
adrs: [0002, 0009]
---

# Publishing & Workspace

The CLI seam between the [Teaching Routine](03-teaching-routine.md) and the
[Hub](01-hub-content.md). A fired run works in a **transient** local workspace
(`topics/<slug>/`) materialised from the Hub, authors there, then [[Publish|publishes]] back. The Hub
is the source of truth ([ADR 0009](/docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md));
the workspace is regenerated every run and must never be treated as storage. (This supersedes the older
local-repo-as-truth model — [ADR 0002](/docs/adr/0002-local-workspace-source-of-truth-neon-mirror-via-mcp.md).)

Each script has a `:prod` twin in `package.json`; all share the env/target helpers in
[_env.ts](/scripts/_env.ts).

## The scripts

| Script | Does | Hub fn |
| --- | --- | --- |
| [`claim`](/scripts/claim.ts#L17) | Hands this run one locked Topic; prints the slug to **stdout only** (so `SLUG=$(pnpm -s claim:prod)` works) and writes the Topic's owner to `.env.local` as `OWNER_EMAIL` for the owner-scoped steps. | [`routine.claimWork`](/convex/routine.ts#L196-L211) |
| [`materialise`](/scripts/materialise.ts#L14) | Pulls the Topic's full context into `topics/<slug>/` — lessons, references, resource blobs, learning records, `CAPTURE.json`, and `MISSION.md` **or** `SEED.md`. | [`routine.materialiseTopic`](/convex/routine.ts#L294-L365) |
| [`review`](/scripts/review.ts#L10) | Prints live learner state (open [[Question]]s, quiz [[Response]]s, [[Progress]]). | `capture.reviewState` |
| [`reply`](/scripts/reply.ts#L17) | Answers one open Question; it flips to `answered` and shows inline in the Reader. | `capture.replyToQuestion` |
| [`publish`](/scripts/publish.ts#L20) | Writes the authored workspace into the Hub (see model below). | `content.*` |
| [`report`](/scripts/report.ts#L20) | Reports the run outcome and releases the lock (called in a `finally`). | [`routine.reportGeneration`](/convex/routine.ts#L159-L181) |

## Publish model

Each artifact type publishes differently — the mutations live in
[content.ts](/convex/content.ts#L231-L310):

- **Lessons** — inserted immutably, or a no-op `"exists"` if the key is already there; a
  `<meta name="supersedes">` retires the named prior lesson. Lean HTML fragments get wrapped with the
  `lessons/_partials/` head/foot at publish time ([publish.ts:47](/scripts/publish.ts#L47-L75)).
- **References** — upserted; if the sha256 `contentHash` matches, publish returns `"unchanged"` and
  skips the write ([publish.ts:131](/scripts/publish.ts#L131)).
- **Learning records** — append-only, insert-once per key.
- **Mission** — published once, flipping the Topic `seeded → active`.

## Materialise & seed state

[`materialise`](/scripts/materialise.ts#L40-L66) writes exactly **one** of `MISSION.md` (Topic has a
drafted mission) or `SEED.md` (only the learner's [[Seed]] "why" — tells the teach skill to draft the
mission first). Resource blobs download to `topics/<slug>/resources/` with an `_index.json` manifest.

## Gotchas

- **The workspace is disposable.** Edits there vanish after the run; author for the Hub, not the folder.
- **`--prod` targets the live deployment.** [_env.ts](/scripts/_env.ts#L26-L44) reads `CONVEX_PROD_URL`
  for `:prod` (fails early if unset) and the dev URL otherwise. Check the target before `publish:prod`.
- **Lesson immutability is enforced at the Hub**, not the script — re-publishing a key silently no-ops;
  to change a lesson, author a superseding one.
- **All publish/operator mutations are `PUBLISH_SECRET`-gated** ([_env.ts](/scripts/_env.ts#L46-L78) →
  [`assertAdmin`](/convex/lib.ts#L7-L10)); the secret must be set both locally and in Convex env.
