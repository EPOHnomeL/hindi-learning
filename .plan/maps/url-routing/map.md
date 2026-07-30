# URL routing follow-ups

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

Bad and inaccessible deep links fail clearly and identically, now that any URL can be typed,
bookmarked, or shared.

## Notes

- **Ticket 01 (the routing spine) already shipped** and is not present as a file; numbering
  starts at 02 because `NN` is a permanent identity. Decisions live in ADR 0012.
- **The security rule is the interesting part, not the 404:** "doesn't exist" and "you can't
  see it" must produce the **identical** response, so the app never reveals which private
  Topics exist. This already matches the owner-or-Viewer reads, which return nothing for an
  inaccessible Topic — the routing layer must not leak what the data layer protects.
- **No silent fallbacks.** Bouncing a bad Lesson key to the first Lesson, or an inaccessible
  course to the dashboard, is explicitly wrong here.
- **The subtle bug to avoid:** reads come from client `useQuery`, which is `undefined` while
  loading, so a naive not-found check fires during load. Show the loading state while
  `undefined`; only trigger not-found on a settled empty result.
- Skills: `/tdd`, `vercel:nextjs` (App Router `not-found` conventions).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- The routing spine and URL scheme — shipped under ADR 0012.
