---
type: task
blocked_by: [03, 08]
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

## Answer

**Built and shipped 2026-08-02**, in the same commit as [10](10-build-donate-route.md).

- **Signed out** — a second effect in `DonateSection` keyed on a hoisted `ready` boolean
  (`slug && flags.donations && config`), which scrolls `#donations` into view the moment the
  section genuinely renders. **It could not ride the existing mount effect**, and that is the
  whole subtlety: hooks run before the early return, so the mount effect fires while the
  component is still returning `null` — the same trap that made the original anchor look
  broken in the first place. Keying on `ready` is what makes it fire after the section is in
  the document.
- **Signed in** — `DonationHashRedirect`, a null-rendering client component inside
  `<Authenticated>` in `src/app/page.tsx`, `router.replace("/donate")` when the hash matches.
  It has to be client-side: **the fragment is never sent to the server**, so no middleware or
  server redirect can see it. It is deliberately *not* rendered while unauthenticated — the
  section is on that page and now scrolls, so a redirect there would be a pointless bounce
  away from content that's already present.

### Verified, and how

**Read and reasoned, not walked.** Both fixes are DOM behaviours (hash handling, scroll,
client redirect) and this repo has no component-test harness — `vitest` runs under
`edge-runtime` for Convex plus pure-function tests, with no jsdom or Testing Library. Adding
one to cover two effects would have been a larger change than the fix. Type check and
`pnpm build` pass; the logic is argued in the comments at both sites.

**So this ticket's Done-when conditions are asserted, not demonstrated.** They are cheap for
a human to check after deploy, and they belong in the same pass as 10's happy path:

1. Signed out, cold-load `https://ywampotch.my-course.app/#donations` → page settles with the
   donation section in view.
2. Signed in, same URL → ends on `/donate` with the widget showing.
3. Signed in, plain `https://ywampotch.my-course.app/` → dashboard, no redirect.
