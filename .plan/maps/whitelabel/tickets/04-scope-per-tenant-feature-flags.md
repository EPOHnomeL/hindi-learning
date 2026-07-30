---
type: grilling
blocked_by: [02]
---
# Scope per-tenant feature flags

## Question

"Each with different features on and off": one tenant may want certificates and translations,
another a bare reader. That needs a flag set on the tenant record and — critically — **backend
enforcement**, not just hidden buttons, since every flaggable feature has Convex functions a
client could still call. Answer:

- Flag inventory: walk the feature surface (certificates/emblems, translations & Editions,
  sharing/invites, Public links, seeding, marketplace/payments, Q&A, Routine on-demand fire,
  future rich-media/video). Which are v1 flags vs hardwired-on?
- Flag shape: flat booleans on the tenant record vs named plans/presets?
- **Enforcement seam:** UI gating is easy — where does backend gating live? Does the auth seam
  (`getOwnedTopic`/`getViewableTopic` in `convex/lib.ts`) also resolve tenant + flags so a
  disabled feature's mutations reject server-side? Pattern for flag-gated HTTP routes and the Routine?
- Interaction with existing grants: a Share/Certificate earned while a feature was on, then the
  flag turns off — revoked, frozen, or read-only? Define the general rule once.
- Defaults & drift: a new flag added later — default on or off for existing tenants?

Out of scope: the tenant record/resolution (02); the flag-management UI (06 decides how the
operator edits flags — this ticket decides shape and enforcement).

## Done when

A deliverable is produced: the v1 flag inventory as a table (flag × four tenants), the
enforcement-seam decision with one worked example (e.g. `certificates` off end-to-end), and the
flag-off-after-grant rule.

## Answer

Resolved 2026-07-16 (grilling), 5 decisions. ADR 0021 left `flags` a placeholder; this ticket
fixes its shape and where enforcement lives.

**Findings:** no marketplace/payments tables exist (nothing to enforce); the candidate v1 gate
points are one mutation each (`claimCertificate` via `getViewableTopic`; `setTopicPublic`/
`setEditionPublic` + `askQuestion` via `getOwnedTopic`; `startTranslation` in
`tryAcquireTranslation`; `seedTopic` has no Topic yet — gates on the creating user's own
`tenantSlug`); read paths are already separate from create paths for every one; the
`getOwnedTopic`/`getViewableTopic`/`getEditableTopic` resolvers are called from far more places
and have no reason to know about flags; Routine on-demand fire already has its own cost guard.

**Decisions:**
1. **Flag shape — flat booleans on the `tenants` row**, not plans/presets. Four known tenants buys
   nothing from a plan layer.
2. **Flag inventory** — five v1 flags: `certificates`, `translations`, `publicLinks`, `qa`,
   `seeding`. **Hardwired-on:** sharing/invites (it *is* the admission path), Routine on-demand
   fire (already cost-guarded). **Future (name reserved, no enforcement built):** marketplace/
   payments, rich-media/video, AI content-regeneration / "Builder prompt box" (operator raised
   mid-grill; doesn't exist in code), dynamic content-aware Q&A (richer successor to `qa`).
3. **Enforcement seam — a separate helper called explicitly inside each gated mutation.** New
   `assertTenantFlag(ctx, tenantSlug, flag)` in `lib.ts`: no-ops when `tenantSlug` absent (default
   site — no regression); else looks up the `tenants` row by `by_slug` and throws if `flags[flag]`
   isn't `true`. Every row carries an explicit boolean per known flag. Resolvers stay flag-agnostic.
   Each gated mutation passes whichever `tenantSlug` it has to hand (`seedTopic` uses the caller's
   own). No flag-gated HTTP route or Routine pattern needed for v1.
4. **Flag-off-after-grant — frozen, not revoked.** One rule for every flag: turning it off blocks
   *creating new* instances and never touches what exists — existing Certificates, Editions, Q&A
   history, minted Public links keep resolving. Guard lives only on create-side mutations, never a
   read query.
5. **Defaults & drift — new flags default OFF (opt-in).** A flag added after this ticket starts
   `false` for every tenant until explicitly flipped on via 06. This is the going-forward policy,
   distinct from the one-time v1 migration that seeds the five known flags `true` everywhere.

**Flags shape:** `flags: v.object({ certificates: v.boolean(), translations: v.boolean(),
publicLinks: v.boolean(), qa: v.boolean(), seeding: v.boolean() })`.

**v1 inventory (acceptance fixture):** all five flags `true` for all four tenants at launch (the
migration default, no regression). Real per-tenant differentiation is a later operator decision.

**Worked example — `certificates` off:** admin flips `flags.certificates` false (a plain scoped
`patch`); `claimCertificate` resolves the Topic then calls `assertTenantFlag(ctx, topic.tenantSlug,
"certificates")` before the eligibility check and throws; the reader also hides the button off the
client context (belt-and-suspenders); already-claimed certs are untouched (read paths never call
the helper). Unblocks the flags half of 06 — 06 now fully unblocked (02✓ 03✓ 04✓).
