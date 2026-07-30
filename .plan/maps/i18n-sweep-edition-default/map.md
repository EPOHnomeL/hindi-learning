# i18n sweep: edition defaults

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

The chrome locale and the served Edition agree by default: a learner reading the app in Hindi
opens the Hindi Edition of a course that has one, edits that Edition's settings, and every
locale's message catalogue is key-complete and green.

## Notes

- **Tickets 01–06 of this effort are already done** — they are not present as files. Ticket 08
  states a dependency on 01 (the settings dialog taking a target `lang` and self-resolving the
  Edition); treat that as satisfied and verify rather than re-derive. This is why numbering
  here starts at 07: `NN` is a permanent identity and is never renumbered.
- **The precedence rule is the spine**, stated in ticket 07 and to be applied consistently:
  URL `?lang` → UI-locale Edition (if the course has it) → last-used `hindi:lang` → English.
- **Identity map:** chrome locale codes are valid Edition codes. An English UI keeps the
  English default.
- **Do not persist a locale-derived default to `hindi:lang`** — that key is an
  explicit-switch memory, and writing defaults into it would make the default sticky and
  unexplainable.
- Sibling map: [app-language-i18n](../app-language-i18n/map.md) owns the chrome-i18n
  architecture (next-intl, cookie-resolved locale, `messages/*.json`). This map consumes those
  decisions; it does not revisit them. Ticket 09's parity test is the one specced there.
- Skills: `/tdd` (ticket 09 is literally a green-test condition).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **The mixed-language marker.** When chrome language and Edition language disagree the state
  is legitimate but reads as a bug. Still fog on the sibling map too — whichever map reaches
  it first should own it, not both.

## Out of scope

- The i18n layer choice, catalogue storage, and string extraction — all locked on
  [app-language-i18n](../app-language-i18n/map.md).
