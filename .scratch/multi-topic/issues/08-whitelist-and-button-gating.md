# 08 — Whitelist the 4 users + gate the on-demand button (usage control)

Status: done — Allowlist is now an admin-managed table (supersedes the env step, 78780d1); on-demand + new-course caps shipped (6ef3148, 1ad476c). Remaining human step: admin adds emails via the portal

Spec: [`../PRD.md`](../PRD.md). Decision:
[ADR 0010](../../../docs/adr/0010-teaching-compute-swappable-adapter.md).

## Want

Bound the alpha to ≈4 trusted accounts and stop authoring from spiking your
Claude subscription.

## Acceptance

- `AUTH_ALLOWED_EMAILS` (prod) set to the 4 emails — gates both sign-up and
  sign-in; the flow already exists ([auth.ts](../../../convex/auth.ts),
  [SignIn.tsx](../../../src/app/_components/SignIn.tsx)). **(human: supply the
  emails / run `npx convex env set --prod`.)**
- The on-demand "Generate next lesson" button is gated: e.g. disabled once a
  Topic has fired today, or rate-limited per user, so the daily schedule is the
  primary authoring path ([ArtifactView.tsx](../../../src/app/_components/ArtifactView.tsx),
  `routine.requestNextLesson`).

## Depends on

- **02** (per-user), **05** (fire-all + claim). Whitelist itself is independent.

## Notes

- This is the "save on usage" knob. Revisit when graduating to per-owner workers
  (ADR 0010 Phase 2), where per-user billing replaces this throttle.
