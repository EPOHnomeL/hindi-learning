---
type: grilling
blocked_by: []
---

# The course mission is translated + billed on every Edition but never read

## Question

**Where it stands:** open — no product decision taken; the Mission is still translated but every surface still renders English

> Deferred follow-up from the PR #4 review (product decision needed).

## What to build

Resolve the mismatch where a course's **mission** is enumerated as a translatable
item — so it's translated and billed a Claude call for every language, and
counted into the job's `total`/`done` — yet **no read seam ever serves the
translated mission**. The "Shared with me" feed and the dashboard both render the
raw English `topic.mission`, so a non-English Viewer sees the English mission and
every added language spends a wasted call.

Pick one direction (this is a product call):

- **Drop it from translation** — stop enumerating the mission item, so no
  language pays for a rendering nobody reads. Non-English surfaces keep showing
  the English mission (unchanged from today), for less cost.
- **Wire it through** — serve the translated mission wherever the mission is
  shown to a holder of that Edition (shared-course card, mission dialog), so the
  billed translation is actually used.

## Acceptance criteria

- [ ] Decision recorded (drop vs. wire-through) with a one-line rationale.
- [ ] If dropped: the mission item is no longer enumerated/translated, and job
      `total` no longer counts it; existing tests still pass.
- [ ] If wired: a Viewer holding only a non-English Edition sees the mission in
      that language on every surface that shows it, with English fallback when a
      mission translation is missing.

## Blocked by

- None — can start immediately.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: the Mission is enumerated into every translation job (translate.ts:53) and billed per Edition, but no read path serves the translated Mission — every surface returns raw English `topic.mission` (content.ts:93,134; shares.ts:295). Tellingly, the shared-feed query resolves the *title* per-Edition (shares.ts:282-289) but never the mission. The product decision (stop translating vs start reading) is still untaken.

### Correction — 2026-08-02: "never read" is no longer true

The headline claim above is **stale**, and the 2026-07-10 comment with it. A read seam for
the translated mission exists now: `loadEdition(...).mission()`
([convex/lib.ts:393-397](../../../convex/lib.ts#L393-L397)) point-reads the `mission` row and
falls back to `topic.mission`, and the reader serves it —
[convex/public.ts:200](../../../convex/public.ts#L200) returns `mission: await ed.mission()`
into the welcome panel. So a Viewer on a translated Edition *does* see the translated
mission in the reader, and the "wire it through" direction is largely already taken.

Found while shipping the `st-ZA` Edition (06), whose mission converted correctly and is
served — so this was verified against a real Edition, not only by reading the code.

**What genuinely remains is narrower than this ticket describes** — the surfaces that still
render raw English:

- **The catalogue card**: [convex/catalogue.ts:118](../../../convex/catalogue.ts#L118) uses
  `topic.mission` directly, with no per-Edition lookup, even though the very next lines
  resolve each listed language for `langs`.
- The shared-feed / dashboard surfaces named in the 2026-07-10 comment need re-checking the
  same way before anyone acts on them; `shares.ts` has moved since.

So the product call is no longer "drop vs wire through" — it is the much smaller "should the
catalogue card show a per-Edition mission, given a card can list several Editions at once?"
Re-scope this ticket before working it, and re-verify each surface: the comment above proves
how quickly this one goes out of date.

## Done when

One direction is picked — drop the mission from translation, or wire the translated mission through the read seams — and the chosen change ships with tests.

<!-- Migrated 2026-07-30 from GitHub issue #65 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

## Ruled out

**Ruled out of scope 2026-08-04 — the effort closed with the ticket's own premise already
falsified, and the residue too small to hold the map open.**

This ticket exists to resolve "the mission is translated and billed but never read". That is
no longer true, and has not been since before 2026-08-02: `loadEdition(...).mission()`
([convex/lib.ts:393-397](../../../convex/lib.ts#L393-L397)) point-reads the `mission` row with
an English fallback, and [convex/public.ts:200](../../../convex/public.ts#L200) serves it into
the reader's welcome panel — verified against the real `st-ZA` Edition, whose mission
converted and renders. The "wire it through" direction was effectively taken without this
ticket.

What remains is one surface: the **catalogue card** renders `topic.mission` directly
([convex/catalogue.ts:118](../../../convex/catalogue.ts#L118)) with no per-Edition lookup. That
is not the question this ticket asks, and it is a genuinely different one — a card can list
several Editions at once, so "show the per-Edition mission" has no single answer there.

Out of scope rather than resolved, because no product decision was taken: the mismatch
dissolved on its own. If the catalogue card is worth doing it should be charted fresh, scoped
to the card, not resumed from a ticket whose framing is stale. The shared-feed and dashboard
surfaces named in the 2026-07-10 comment were never re-verified and should not be trusted
either way.
