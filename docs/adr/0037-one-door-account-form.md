---
status: accepted
supersedes: 0021 (one consequence line)
---

# The account form has one door: sign in, else sign up

Decided 2026-09-18.

The sign-in form no longer asks a visitor which of the two they are. One email
field, one password field, one **Continue**. The client tries `signIn`; if that
throws it tries `signUp`. A returning visitor is signed in and a new one is
registered, in a single press, with nothing to toggle.

## Context

Until now the form carried a `signIn`/`signUp` toggle, and three separate paths
guessed which side to open it on: `/checkout/*`, `/redeem` and `/sign-up` opened
"Create account", everything else opened "Sign in". The guess was a guess. A
returning buyer met a create-account form; a first-time visitor arriving from a
share link met a sign-in form. Either way they had to read the toggle line,
understand that the two sides are different, and press it before typing.

The copy that made the toggle legible ("No account? Sign up", "Already have an
account? Sign in", a purchase-flavoured lead) existed only because the toggle
did. And it is a question the visitor should not have to answer, because the
server already knows the answer: the address either has a `password` account or
it does not.

## Decision

- **One door.** `SignIn` has no `signIn`/`signUp` state. Its submit handler posts
  `flow: "signIn"` and, only on failure, `flow: "signUp"`.
- **That order, never the reverse.** Sign-up-first would be attempted against
  every returning visitor, and it is the destructive half: `createAccount` throws
  on a taken address today, but a provider change that ever made it link instead
  would silently repoint a live account. Sign-in-first can only ever succeed for
  somebody who already holds the credential.
- **The length rule moves to the client too.** `MIN_PASSWORD_LENGTH = 8` mirrors
  the Password provider's own `validateDefaultPasswordRequirements` and is
  checked before either attempt. That is what makes the fallback legible: with a
  long-enough password the only everyday reason `signUp` ALSO fails is that the
  address is taken, so two failures mean **wrong password** and are reported as
  that, with the forgot-password line sitting right above the button.
- **Terms are shown to everyone**, not only on a declared sign-up: pressing the
  button may be what creates the account.
- **`/sign-in`, `/sign-up`, `/redeem` and `/checkout/*` all render the same
  form.** The path still selects the checkout step rail and its copy; it no
  longer selects a flow. `/sign-up` survives as a second name for `/sign-in`,
  because outside links point at it and a dead link is worse than a duplicate.

## Consequences

- **A typo in the email address now creates a second account** rather than
  failing with "sign-in failed". Accepted: it is the standing cost of a combined
  door, and the visitor lands in an empty workspace immediately, which is a
  louder signal than a failed sign-in was. The purchase rail is unaffected
  because it is auth-first (ADR 0021): entitlement attaches to whatever account
  is signed in, and a fresh account with none simply meets the paygate.
- **Account-existence disclosure narrows.** Before, a sign-up attempt reported
  "that address is taken" outright to anybody who typed an address. Now that
  answer is only reachable by someone who also submits a password, and only in
  the shape "wrong password". The reset rail's deliberate silence is untouched:
  step one of a reset still tells the visitor nothing.
- **Convex Auth is unchanged.** No server code moved. `createOrUpdateUser` keeps
  the Seat branch, the email-linking rule (#111) and the Seat-adoption guard
  exactly as they were. The Google button already signed in and signed up
  identically, which is the promise the password button now matches.
- **ADR 0021's line** describing SignIn as "defaulting to Create account" at a
  deep-linked buy URL is superseded by this one: there is no default to pick.
  Nothing else in 0021 is reopened.
- **Analytics.** `auth_password_submitted` no longer carries a meaningful `flow`.
  `auth_password_succeeded` is new and carries `created: boolean`, which is the
  new-versus-returning split the visitor used to declare by toggling.

## What this does NOT decide

**Email verification.** A password sign-up is still unverified at the moment it
is made (ADR 0021), and this changes nothing about that. It does raise the value
of building it: with one door, a mistyped address creates an account rather than
bouncing off one.

**The Organisation Voucher and Access Code doors.** `/join` and `/redeem` are
separate rails with their own credentials (ADR 0031) and are untouched.
