# 01 — Completion state, the authoring stop-gate, and termination (tracer bullet)

Status: done — shipped 88a2f83 (fix 488681b)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Completion**, **Frontier**, **Routine**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0015](../../../docs/adr/0015-course-completion-and-certificates.md).

## Want

The spine everything else hangs off: a Topic can reach **Completion**
(`status: "completed"`), the teach skill and the owner can put it there (and the
owner can reopen it), and the Routine's gate refuses to author for a completed
Topic. After this slice a finished course provably stops generating Lessons —
with no certificate or UI polish yet.

## Acceptance

- `topics.status` gains a `completed` value alongside `seeded | active` (still
  optional, for the legacy unowned row).
- **`completeCourse`** — publish-secret-guarded (same guard as
  `reportGeneration` / `replyToQuestion` via `assertAdmin`), takes a Topic slug,
  sets it `completed`. This is the teach skill's termination call.
- **Owner end-course** — an authed, owner-only mutation (through the existing
  owner gate, like `capture`'s `requireOwnedTopic`) sets the caller's own Topic
  `completed`. Refused for a Viewer / non-owner server-side.
- **Reopen** — an authed, owner-only mutation returns a `completed` Topic to
  `active`. (A secret-guarded reopen path is acceptable but not required.)
- **`tryAcquireGeneration` refuses a completed Topic** before the Frontier check,
  returning `{ acquired: false, reason: "completed" }`, so `requestNextLesson`,
  `requestSetup`, and `dailyFire` all no-op on it. Authoring resumes normally
  after a reopen. The existing `caughtUp` soft-stop is untouched.
- **Teach skill doc** — add a "Terminating a course" section to
  [`.claude/skills/teach/SKILL.md`](../../../.claude/skills/teach/SKILL.md):
  judge against the Mission's "Success looks like"; call `completeCourse` when
  those outcomes are substantially met or the ZPD is exhausted / returns diminish;
  note that lifelong/open-ended missions may only ever end via the owner's manual
  action, not auto-termination.

## Depends on

- Nothing (foundation for `02`–`05`).

## Notes

- Keep termination and the gate as the only concerns here; certificates are `02`.
- `materialiseTopic` already returns `topic.status`, so a claimed run can see it's
  `completed` — fine to leave; the gate is the real stop.
- Covers PRD stories 1, 2, 3, 4, 5 (mutation only — UI in `03`), 7, 8 (mutation),
  9 (server refusal), 11, 12.
