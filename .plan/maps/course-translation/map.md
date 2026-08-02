# Course translation follow-ups

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

The three deferred follow-ups from the translation review closed out: the mission that is
translated but never read, the RTL reader chrome plus a re-translate affordance, and the last
Edition-lifecycle cleanups. This map finishes shipped work rather than charting new ground.

## Notes

- **Content translation already ships** — the `translations` table, `convex/translate.ts`,
  the per-Edition reader switcher. Everything here is a follow-up on that, not a re-design.
- **Ticket 02 is a product call, not a bug:** the mission is enumerated as translatable, so
  every language pays a call for it, and no read seam ever serves the result. Pick a
  direction — drop it, or wire it through — either is defensible; the current state is not.
- **Ticket 03 overlaps [app-language-i18n](../app-language-i18n/map.md), which ruled RTL out
  of scope** (all five target chrome languages are LTR). The overlap is only apparent: this
  is the *reader frame's direction flip around a translated Edition*, not chrome
  localisation. Coordinate so neither map duplicates the other.
- Ticket 04's removal race and error-clear already landed (`a255df8`); what remains is the
  dead index and recording the `setTopicPublic` decision. Verify before rebuilding.
- Skills: `convex:convex-expert`, `/tdd` (all three are testable seams).
- **The `st-ZA` Edition (06) is LIVE on prod** — all 59 rows published 2026-08-02, `st`
  verified untouched. It shipped ahead of its own review gate on the user's call: the rules
  were inferred by an agent that does not read Sesotho, so
  [07](tickets/07-sesotho-translator-verdict-on-the-ledger.md) puts the word ledger to a
  translator and corrections get republished afterwards. That is only safe because the
  transform is idempotent — re-running `--publish` costs nothing.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- App-wide chrome localisation ([app-language-i18n](../app-language-i18n/map.md)).
- Who pays for translated Editions —
  [Authoring-cost funding & model-provider strategy](../marketplace/tickets/01-authoring-cost-and-model-provider-strategy.md).
