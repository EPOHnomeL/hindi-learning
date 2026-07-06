# 05 — Read-seam paid/free fork + the Preview gate

Status: needs-triage

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Preview**, **Entitlement**, **Guest**, **Public link**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).

## Want

Wire the read seams to `resolveTopicAccess` (issue 02) so a **paid** Topic reveals
only the **Preview** to callers without an Entitlement, while **free** Topics and
all owner/Viewer/entitled reads are unchanged. This is the only new read-fork.

## Acceptance

- **Authed reader** ([`convex/content.ts`](../../../convex/content.ts)) — `getLesson`
  / `getReference` / `listLessons` / `listReferences`:
  - On a **free** Topic: unchanged (owner/Viewer only, as today).
  - On a **paid** Topic: an **entitled** caller (and owner/Viewer) reads everything;
    any other signed-in caller gets **`preview`** access — the **Preview** Lesson's
    HTML is returned, every other Lesson/Reference returns a **locked** marker (not
    `null`), and the ToC (`listLessons`) still lists titles so the UI can show what's
    behind the paygate.
- **Guest seam** ([`convex/public.ts`](../../../convex/public.ts)) — `publicCourse`
  / `publicLesson` / `publicReference`:
  - On a **free** public Topic: unchanged (full mirror, ADR 0013).
  - On a **paid** public Topic: `publicCourse` still returns the **ToC** (lesson
    titles/keys) + `title` as a teaser; `publicLesson` returns HTML **only** for the
    **Preview** key and a **locked** marker otherwise; `publicReference` is locked.
    Keep the **explicit output allowlist** discipline — a Guest never receives paid
    HTML.
- **A `locked` shape** distinct from `null`: `null` still means "no such
  Topic/Lesson" (privacy-preserving for bad tokens); `locked` means "exists, buy to
  read" so the reader renders a paygate/buy affordance (PRD story 14), not a 404.
- **Buy affordance data**: the course header / `publicCourse` expose `price` +
  whether the caller is entitled, so the reader knows to show "Buy" vs full content.

## Depends on

- **02** (`resolveTopicAccess`, `topics.price`, Preview helper, entitled ≡ Viewer).
- Soft: **04** provides the checkout URL the buy affordance links to (the gate itself
  works without it — locked content just can't be unlocked yet).

## Notes

- Gate at these two seams **only** — do not re-check per React component (mirrors the
  internal-studio PRD's "gate at read time" rule). The reader trusts what the seam
  returns.
- The Preview must be readable by **everyone** on a paid Topic — including a
  signed-in user who hasn't bought — so the buy flow works whether or not they're
  logged in. That's why `preview` is a distinct level in `resolveTopicAccess`, not
  just "Guest".
- Tests mirror `public.test.ts` + `sharing-readonly.test.ts`: paid Topic → Preview
  HTML only for Guest / unentitled-authed, full for entitled/owner/Viewer; free Topic
  byte-for-byte unchanged; `locked` vs `null` asserted; the Guest allowlist never
  leaks paid HTML.
