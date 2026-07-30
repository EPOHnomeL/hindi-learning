# Paid marketplace economics

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

Two linked economic decisions closed: **who funds the up-front authoring cost of a paid
course**, and the **model-provider strategy** underneath it — decided against real numbers,
not blind.

## Notes

- **Deliberately deferred, not stalled.** The owner is monitoring real authoring cost before
  committing. The blocking data is per-run token instrumentation —
  [internal-course-studio/03](../internal-course-studio/tickets/03-cost-instrumentation.md).
  Take that first; this map cannot honestly resolve without it.
- **The cost is spent up front on a course that may never sell:** ADR 0016 requires a paid
  course to be fully authored *before* it is listed.
- **Translation is the same problem one layer out.** Selling in a language means selling an
  Edition, and translated Editions are produced on the operator's key — so a sold translated
  Edition carries an operator cost the platform cut must recoup. Answer both together.
- **The fork, from the original grilling:** Seller-BYOK (zero operator exposure, most
  consistent with ADR 0016's independent-merchant framing) / operator-funded (frictionless,
  unbounded exposure) / operator-funded-but-metered (recovers cost, but needs metering built
  now and charges the Seller twice).
- **This does not block the paygate spine.** Stripe Connect wiring, the Entitlement model, the
  can-sell grant, and checkout can all ship while funding is monitored — the funding choice
  affects economics, not access mechanics.
- Downstream consumers of whatever this decides:
  [ai-chat/01](../ai-chat/tickets/01-interactive-ai-chat-substrate.md) (per-learner chat
  cost), [course-authoring/03](../course-authoring/tickets/03-self-serve-course-building.md)
  (a self-serve generate button is a metered cost per click),
  [course-media/02](../course-media/tickets/02-scope-course-audio.md) (TTS per Edition).
- Skills: `/grilling`; ADR 0014 and ADR 0016 are the standing decisions.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **BYOK key storage mechanics** (per-owner encrypted, scoped, never logged) — a real build
  named in ADR 0014, only worth ticketing if the BYOK branch wins.

## Out of scope

- The paygate access mechanics — already decided and shipping.
