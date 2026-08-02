---
type: task
blocked_by: [03, 08]
claimed_by: donate-route-session
claimed_at: 2026-08-02T09:52:32+02:00
---

# Fix the legacy `#donations` link in both auth states

> `/wayfinder .plan/maps/marketplace/tickets/11-fix-legacy-donations-anchor.md`

## Question

`<tenant>.my-course.app#donations` is already shared — ticket 03 called the anchor "the
requirement" — so it has to keep working after [10](10-build-donate-route.md) adds `/donate`.
It doesn't today, for two different reasons in the two auth states.

Read [the spec](../spec-donate-route.md) for the diagnosis. In short: the anchor id is
correct and nothing redirects; `DonateSection` simply isn't in the document when the browser
acts on the hash.

Scope, as decided:

- **Signed out** — scroll to the section once it has *actually mounted*, not on first render.
  `DonateSection` already runs a mount effect reading `window.location` for `?donation=thanks`,
  but that effect fires before the early-return gate resolves, so the scroll has to key off
  the point where the section is genuinely rendered.
- **Signed in** — `/` with `#donations` client-redirects to `/donate`. `<Dashboard/>` has no
  donation section and is not gaining one; the redirect is what makes a shared link work for
  a logged-in visitor.

## Done when

- A cold load of `<tenant>.my-course.app#donations` signed out lands with the donation
  section in view.
- The same URL signed in ends up on `/donate` showing the widget.
- Neither path disturbs `/` for a visitor who arrives without the hash.
