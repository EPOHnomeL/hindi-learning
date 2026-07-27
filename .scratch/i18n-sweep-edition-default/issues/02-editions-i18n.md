# 02 — Editions & sharing modal → next-intl

Wire `src/app/_components/Editions.tsx`. New namespace `Editions`.

Cover: dialog title; loading/error; tab aria/title (Source badge, Translating,
Failed, Add a language); EditionPanel translating/failed body (`{done}/{total}`,
`{native}`); InviteByEmail (placeholder, Invite/Inviting, help text, error, the two
success lines with `{email}`); AccessRoster (loading, empty, "Who has access");
AccessRow (pending, Can view/Can edit, revoke label+title with `{email}`);
PublicLinkToggle (label, on/off body, Copy/Copied, Regenerate); PayoutDetailsForm
(labels/placeholders/error/save); SellEdition (all status/CTA/price copy, `{native}`,
`{price}`); RetryTranslation; RemoveEdition; AddLanguagePanel (locked/intro copy,
search placeholder, RTL suffix, no-match).

Done when: modal fully renders in the active locale; keys in en.json; tsc clean.
