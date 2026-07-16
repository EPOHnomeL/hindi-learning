# whitelabel/04: Scope per-tenant feature flags

**Status:** done
**Claimed:** session 2026-07-16 (feature-flags grilling)
**Depends on:** 02
**Labels:** wayfinder:grilling

Child of [Whitelabel map](00-whitelabel-map.md).

## Why

"Each with different features on and off": one tenant may want certificates and translations,
another a bare reader; the marketplace/payments rail should exist on some sites and not
others. That needs a flag set on the tenant record and — critically — **backend enforcement**,
not just hidden buttons: every flaggable feature has Convex functions a client could still
call.

## Questions to answer

- Flag inventory: walk the feature surface and mark what's plausibly toggleable —
  certificates/emblems, translations & Editions, sharing/invites, Public links, seeding new
  Topics vs. read-only catalogue, marketplace/payments, Q&A (questions/replies), Routine
  on-demand fire, and (future) rich-media/video courses. Which are v1 flags for the four
  tenants vs. hardwired-on?
- Flag shape: flat booleans on the tenant record vs. named plans/presets? (Four known tenants
  argues for flat booleans + ponytail; note what a plan abstraction would buy later.)
- **Enforcement seam**: UI gating via a tenant context/hook is easy — where does backend
  gating live? The auth seam (`getOwnedTopic`/`getViewableTopic` in
  [`convex/lib.ts`](../../../convex/lib.ts)) resolves the Topic; does it also resolve the
  tenant + flags, so a disabled feature's mutations reject server-side? What's the pattern for
  flag-gated HTTP routes and the Routine?
- Interaction with existing grants: a Share/Certificate earned while a feature was on, then
  the flag turns off — revoked, frozen, or read-only? Define the general rule once.
- Defaults & drift: new flag added later — default on or off for existing tenants?

## Out of scope

- The tenant record/resolution itself (02).
- The flag-management UI — no longer deferred outright: the user wants an operator dashboard,
  scoped in [ticket 06](06-scope-operator-whitelabel-dashboard.md). This ticket decides the flag
  *shape and enforcement*; 06 decides how the operator edits it.

## Deliverable

The v1 flag inventory as a table (flag × four tenants), the enforcement-seam decision with one
worked example (e.g. `certificates` off end-to-end), and the flag-off-after-grant rule.

---

## Resolution (2026-07-16, grilling session)

Grilled to shared understanding across 5 decisions. ADR 0021 (ticket 02) left `flags` a placeholder
on the `tenants` row; this ticket fixes its shape and — the part that actually matters — where
enforcement lives.

### Findings that framed the questions (codebase reality, verified this session)

- **No marketplace/payments tables exist yet** — matches ADR 0021 §5 (deferred to the payments
  roadmap) and the project's gated-phases stance. Nothing to enforce today.
- **The candidate v1 gate points, one mutation each:**
  `claimCertificate` ([`certificates.ts`](../../../convex/certificates.ts)) resolves via
  `getViewableTopic`; `setTopicPublic`/`setEditionPublic`
  ([`shares.ts`](../../../convex/shares.ts)) and `askQuestion`
  ([`capture.ts`](../../../convex/capture.ts)) resolve via `getOwnedTopic`;
  `startTranslation` ([`translate.ts`](../../../convex/translate.ts)) is owner-gated inside its
  `tryAcquireTranslation` mutation; `seedTopic` ([`content.ts`](../../../convex/content.ts)) has
  **no Topic yet** — it gates on the *creating user's own* `tenantSlug`, not a Topic's.
- **Read paths are already separate from create paths** for every one of these: `myCertificate`/
  `publicCertificate`, the Editions panel's existing-link display, `myQuestions` — none of them
  re-check anything at read time today. A flag guard added only to the create-side mutations slots
  in without touching any read query.
- **`getOwnedTopic`/`getViewableTopic`/`getEditableTopic`** ([`lib.ts`](../../../convex/lib.ts))
  answer one question each ("does this user own/view/edit this Topic") and are called from far more
  places than the five flaggable actions — the hot dashboard-list and lesson-read paths run through
  them constantly and have no reason to know about any tenant flag.
- **Routine on-demand fire** (`requestNextLesson`/`finishGenerating` in
  [`routine.ts`](../../../convex/routine.ts)) already has its own cost guard — the per-Topic manual
  cooldown (issue 08) — orthogonal to tenancy.

### Decisions

1. **Flag shape — flat booleans on the `tenants` row**, not named plans/presets. Four known
   tenants buys nothing from a plan layer today; a plan abstraction would only pay for itself with
   many more tenants or a self-serve upgrade motion, neither of which exists. Ticket 06's dashboard
   renders one toggle per flag.
2. **Flag inventory** — walked the full feature surface named in the ticket, plus two more the
   operator raised mid-grill (AI content-regeneration / "Builder prompt box", and a more dynamic
   content-aware Q&A):

   | Feature | Disposition |
   |---|---|
   | Certificates / emblems | **v1 flag** (`certificates`) |
   | Translations & Editions | **v1 flag** (`translations`) |
   | Public links (anonymous share) | **v1 flag** (`publicLinks`) |
   | Q&A (questions/replies) | **v1 flag** (`qa`) |
   | Seeding new Topics (vs. read-only catalogue) | **v1 flag** (`seeding`) |
   | Sharing/invites (Share to another account) | **hardwired-on** — this *is* the admission
     path (pendingShares/whitelist); gating it risks locking a tenant out of onboarding its own
     members |
   | Routine on-demand fire | **hardwired-on** — already cost-guarded by its own per-Topic manual
     cooldown (issue 08), independent of tenancy |
   | Marketplace/payments | **future** — name reserved, no enforcement built (nothing exists to
     enforce; payments roadmap owns this) |
   | Rich-media/video courses | **future** — name reserved (parallel `.scratch/rich-media/` effort) |
   | AI content-regeneration / "Builder prompt box" | **future** — name reserved; doesn't exist in
     the codebase today (verified: no `regenerate`/`builder` feature in `convex/`) |
   | Dynamic, content-aware Q&A (personalised to what a learner already knows) | **future** —
     folded in as a richer successor to the `qa` flag, not a separate flag yet |

   Five v1 flags: `certificates`, `translations`, `publicLinks`, `qa`, `seeding`.
3. **Enforcement seam — a separate helper, called explicitly inside each gated mutation.**
   `getOwnedTopic`/`getViewableTopic`/`getEditableTopic` stay flag-agnostic — they answer
   ownership/visibility, a different question from "is this feature on for this tenant," asked by a
   much smaller set of call sites. A new `assertTenantFlag(ctx, tenantSlug, flag)` in `lib.ts`:
   - No-ops when `tenantSlug` is absent (the default site, and any not-yet-tenanted Topic/user) —
     every v1 flag is implicitly on off-tenant, exactly today's behaviour, no regression.
   - Otherwise looks up the `tenants` row by `by_slug` and throws if `flags[flag]` is not `true`.
   - Every tenant row always carries an **explicit** boolean for every known flag key — no
     optional-with-implicit-default ambiguity. Adding a flag later is a migration that backfills
     the new key onto every existing tenant row (per decision 5, `false`); it is never silently
     absent.
   - Each gated mutation resolves **whichever `tenantSlug` it already has to hand**: the four
     topic-scoped ones (`claimCertificate`, `setTopicPublic`/`setEditionPublic`, `askQuestion`,
     `startTranslation`) call it with the resolved Topic's `tenantSlug`; `seedTopic` calls it with
     the calling user's own `tenantSlug` (there is no Topic yet).
   - No flag-gated HTTP route or Routine pattern is needed for v1 — none of the five flags land on
     an HTTP route, and Routine on-demand fire ended up hardwired-on (decision 2).
4. **Flag-off-after-grant — frozen, not revoked. One general rule for every flag.** Turning a flag
   off blocks *creating new* instances (no new Certificate claimed, no new translation job started,
   no new Question asked, no new Public link minted) and never touches what already exists —
   existing Certificates, translated Editions, Q&A history, and already-minted Public links keep
   resolving indefinitely. Matches how the rest of the app already treats earned things (Certificates
   are immutable rows, ADR 0015); the guard lives only on the create-side mutations named in
   decision 3, never on a read query.
5. **Defaults & drift — new flags default OFF (opt-in).** A flag added after this ticket ships
   starts `false` for every tenant until an operator/tenant-admin explicitly flips it on via ticket
   06's dashboard — cost-bearing or support-bearing features (translation spend, future AI
   generation, Q&A-like support load) should never silently turn on. This is the *going-forward*
   policy, distinct from the one-time v1 migration below, which seeds the five known flags `true`
   everywhere to preserve today's always-on behaviour.

### The flags shape (handed to schema / ticket 06)

Inline on the `tenants` row, alongside `slug`/`displayName`/`theme` (03):

```ts
flags: v.object({
  certificates: v.boolean(),
  translations: v.boolean(),
  publicLinks:  v.boolean(),
  qa:           v.boolean(),
  seeding:      v.boolean(),
})
```

### v1 flag inventory — the four tenants (acceptance fixture)

**Placeholder.** All five flags `true` for all four tenants at launch — this is the migration
default (decision 5), preserving today's single-site always-on behaviour with no regression. Real
per-tenant differentiation (e.g. a reader-only brand with `seeding: false`) is an operator decision
made later via ticket 06's dashboard, not this ticket.

| | upf | ywampotch | almighty-warriors | yknot |
|---|---|---|---|---|
| `certificates` | true | true | true | true |
| `translations` | true | true | true | true |
| `publicLinks` | true | true | true | true |
| `qa` | true | true | true | true |
| `seeding` | true | true | true | true |

### Worked example — `certificates` off end-to-end

1. A tenant admin flips `flags.certificates` to `false` on their tenant row (ticket 06's dashboard —
   a plain `patch` mutation, scope-checked by the two-tier admin model from ADR 0021).
2. `claimCertificate` resolves the Topic via `getViewableTopic` (unchanged), then calls
   `assertTenantFlag(ctx, topic.tenantSlug, "certificates")` before the eligibility check — throws
   when the tenant has it off; the client surfaces this as an error.
3. The reader's "Claim certificate" UI reads the same flag off the client tenant context (03's
   `useQuery`, extended to also return `flags`) and hides the button when off — belt-and-suspenders;
   the server-side throw in step 2 is the one that actually matters.
4. Existing Certificates already claimed on that tenant are untouched: `myCertificate` and
   `publicCertificate` never call `assertTenantFlag` — only the create path does — so a certificate
   claimed before the flag flipped keeps resolving via its token link forever (decision 4).

### 04's implementation issues (for the eventual PRD breakdown)

1. Schema: add the `flags` object to the `tenants` table; seed all four tenants with all five
   flags `true`.
2. `assertTenantFlag(ctx, tenantSlug, flag)` in `convex/lib.ts` (no-ops off-tenant; throws when a
   tenanted flag is off).
3. Wire the guard into the five create-side mutations: `claimCertificate`, `setTopicPublic`,
   `setEditionPublic`, `askQuestion`, `startTranslation`'s `tryAcquireTranslation`, and `seedTopic`
   (the last gated on the caller's own `tenantSlug`, not a Topic's).
4. Extend the client tenant context (03) to also expose `flags`, so reader chrome can hide
   flagged-off UI (belt-and-suspenders over the server guard).
5. Surfaced in ticket 06's dashboard: one toggle per flag, scope-checked by the two-tier admin
   model.
6. **Downstream (own ticket, not v1 mechanism):** whenever the AI-regeneration/Builder-prompt-box
   or dynamic-Q&A features actually get built, they land through this same inventory — add the flag
   key, migrate every tenant row to `false`, then let an operator opt tenants in (decision 5).
