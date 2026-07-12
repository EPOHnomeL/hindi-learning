# 03 — Signed-out Buy routing: share link → sign-in → dialog open

Status: open

## Parent

[PRD: Auth-first checkout + open sign-up](../PRD.md)

## What to build

Buy on a Public link routes into the authed app, deep-linked to the same content.

- Share reader (`PublicReader.tsx` / its Paygate use): the Buy CTA becomes a **link** to
  the same Lesson/Reference under
  `/courses/<slug>/(lessons|references)/<key>?lang=…&buy=1` — no dialog on the share
  page, uniform for signed-in and signed-out visitors.
- `SignIn.tsx`: when the URL carries `buy=1`, the form defaults to **"Create account"**
  with purchase-flavoured copy ("Create an account to complete your purchase — already
  have one? Sign in"); without the marker the default stays "Sign in".
- Authed reader (`ArtifactView.tsx` / `Paygate.tsx`): `buy=1` + `preview`-level access
  auto-opens the BuyDialog; any holder (owner/viewer/entitled) renders unlocked content
  and the marker is ignored.

## Acceptance criteria

- [ ] Share-page Buy navigates to the matching /courses lesson (and reference) URL with lang + buy marker.
- [ ] Signed out, that URL shows SignIn defaulting to "Create account"; the toggle still reaches sign-in.
- [ ] After auth, the same locked page renders with the buy dialog open.
- [ ] A holder landing with `buy=1` sees unlocked content, no dialog.
- [ ] `tsc`, tests, build green.

## Blocked by

- [02 — Auth-first checkout: the account is the buyer](02-auth-first-checkout.md)
