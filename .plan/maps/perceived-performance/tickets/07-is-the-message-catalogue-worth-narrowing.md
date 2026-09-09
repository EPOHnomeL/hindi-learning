---
type: grilling
blocked_by: []
---
# Is the full message catalogue worth narrowing?

## Question

`src/app/layout.tsx` mounts `<NextIntlClientProvider>` with no `messages` prop, so it
inherits the whole catalogue from the request config and serialises **all of it** into
the RSC payload on every cold load, regardless of how many strings the page actually
uses. Measured 2026-09-09: `en.json` is 45 KB, `hi.json` 84 KB, `ur.json` 65 KB, `fr.json`
51 KB.

next-intl supports narrowing what crosses the boundary, and the namespaces here are
already cleanly separated (`Reader`, `Common`, `Artifact`, and the rest), so the
mechanism is not the problem.

**The question is whether it is worth it**, and there is a real case for no:

- The catalogue is JSON over a compressed response, so the wire cost is a fraction of the
  raw figure. Nobody has measured what that fraction actually is, and the whole decision
  turns on it. **Measure it before arguing about it.**
- It is paid on cold load, not on client navigation, because the layout does not
  re-render. So this is a first-visit cost, not a per-page cost.
- The cost is not the code, it is the **maintenance rule**: every future component that
  reaches for a new namespace has to know it must be added to a list somewhere, and the
  failure mode is a missing-translation fallback in production rather than a build error.
  The repo's `getMessageFallback` returns the raw key, so a miss ships a visible key
  string to a learner.

The Hindi and Urdu figures are the strongest argument for yes: the locales carrying the
largest catalogues are the ones most likely to be read on the slowest connections, which
inverts the usual "it is only 45 KB" dismissal.

Grill it properly and answer three things:

- What the catalogue actually costs on the wire, compressed, per locale, on a cold load.
- Whether a narrowing rule can be made to fail at build rather than in production. If
  type-level enforcement is achievable, the maintenance objection mostly evaporates and
  the answer is probably yes.
- Whether there is a cheaper shape that gets most of the win, for instance splitting only
  the two or three largest namespaces out rather than curating every route.

## Done when

The question is answered with a number, not an intuition, and either:

- **A build ticket is filed on this map** carrying the agreed shape and the enforcement
  rule, and this ticket's Answer points at it. Note that resolving this ticket without
  filing that ticket would render the decision as Done, which reads as shipped; it is
  not, and the map's conventions are explicit about that split.
- Or the ticket is closed with `## Ruled out` recording the measured compressed cost and
  why it does not earn the maintenance rule.
