# 04 — The completion celebration (confetti + reveal + claim)

Status: done — shipped ff7ec91 (in-modal claim later superseded by auto-open, 7575a92)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Certificate**, **Completion**). Spec: [`../PRD.md`](../PRD.md).

## Want

The rewarding moment: when a learner becomes eligible for a Certificate, the
reader celebrates — a confetti burst and a certificate-card reveal — and collects
the name that completes the claim, leading straight into viewing/downloading it.

## Acceptance

- Add **`canvas-confetti`** (small, framework-free) as the confetti primitive;
  the reveal uses Tailwind/CSS transitions (scale-in / fade / a shine sweep),
  the animation idiom already in the repo (`animate-ping`/`bounce`/`pulse`).
- The celebration appears when `myCertificate` (`02`) reports the caller is
  **newly eligible or just earned** on the course they're viewing. It contains
  the **name field** (prefilled blank, placeholder guidance) whose submit calls
  `claimCertificate` (`02`); on success it transitions to a "View / Download
  certificate" call-to-action (into `05`).
- It fires **once**: after first view it's suppressed via a per-Certificate
  marker in `localStorage` (same per-device pattern as the reader's seen-replies
  / Guest ticks). Revisiting a completed lesson does not re-trigger it.
- It fires for **whoever becomes eligible whenever they next load** the completed
  course — an owner who was absent when the teacher terminated, or a Viewer who
  had already finished — not only at the instant of the final "Mark complete".
- A learner who dismisses it without naming can still claim later from the "View
  certificate" affordance (`03`).

## Depends on

- `02` (`myCertificate` + `claimCertificate`), `03` (the affordance it leads
  into). Sits in the reader alongside `03`.

## Notes

- Keep the confetti a one-shot burst, not a loop, and respect
  `prefers-reduced-motion` (skip/soften the animation).
- No frontend tests (repo norm); verify manually across owner-earns,
  Viewer-earns, and the once-only suppression.
- Covers PRD stories 16 (the prompt UI), 21, 22, 23.
