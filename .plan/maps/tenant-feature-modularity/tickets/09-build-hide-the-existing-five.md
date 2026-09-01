---
type: task
blocked_by: [08]
---
# Build: hide the affordances of the five existing flags

## Question

The five original flags are enforced server-side and invisible client-side, so a learner on a
tenant with `certificates` off still sees the Claim button, clicks it, and gets *"This feature isn't
available on this site."* Put every one of them behind the seam from
[08](08-build-the-client-flag-seam.md).

This ticket touches no server code. `assertTenantFlag` stays exactly where it is at all five sites;
the point is that nobody ever reaches it by accident.

The affordances, found at charting (2026-09-01). Re-verify each before wiring, since the UI moves:

- **`certificates`**: the Claim affordance and the certificate surface in the reader chrome.
- **`translations`**: the Editions panel's add-a-language `+` tab and the reader's
  `LanguageSwitcher`. Careful here. Project context pins a rule: the switcher is gated by
  `header.editions.length > 1` **only**, never by `canWrite`. A flag gate is a third condition, not
  a replacement, and a Viewer holding two shared editions on a `translations`-off tenant is the case
  to think about, because those editions already exist and frozen-not-revoked says they keep working.
- **`publicLinks`**: the lock-to-globe public-link toggle inside the Editions dialog.
- **`qa`**: the ask-your-teacher block, the Q&A panel, and the sidebar unread-reply dot. This one
  composes with the per-Topic `teacherQa` setting, and 01's grain rule says how. The teacher-qa map
  already hides the same unit for a different reason, so reuse its seam rather than adding a second.
- **`seeding`**: the New course card on the dashboard and any other entry into the seed flow.

## Done when

- [ ] Certificates: the Claim affordance is gone when the flag is off, and an already-claimed
      certificate still resolves and still renders.
- [ ] Translations: the add-a-language tab is gone when off; the reader `LanguageSwitcher` still
      obeys the `editions.length > 1` rule and still shows for a holder of existing editions.
- [ ] Public links: the toggle is gone when off, and revoking an existing link is still possible.
- [ ] Q&A: the ask block, panel and unread dot hide as one unit, composed with `teacherQa` per 01's
      rule, reusing the teacher-qa map's existing seam rather than a parallel one.
- [ ] Seeding: the New course card is gone when off.
- [ ] Every one of the five has a test asserting the affordance is absent when off and present when
      on.
- [ ] No `assertTenantFlag` call was removed, weakened or moved. Say so explicitly in the Answer.
- [ ] `pnpm typecheck` and the unit suite are green.
