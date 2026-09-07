# Technical foundation: scalability, refactoring and code architecture

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand. -->

## Destination

Every open decision about **how this codebase is built** lives in one place, with its
dependencies visible, so that a session picking up architecture work can see the whole
frontier without reading twelve feature maps.

Chartered 2026-09-01 by gathering the technical work that was scattered across twelve
feature maps, plus five items of real architecture debt that no ticket covered at all.

The destination is reached when this map's tickets are resolved, not when the codebase is
"clean". Scope is fixed by one test: **would this change be worth doing if no feature
needed it?** Read amplification, module boundaries, data-model gaps, decision-record drift
and deliberate-shortcut debt all pass. A feature that happens to need a migration does not.

## Notes

- **This map carries build tickets, deliberately.** wayfinder's default is plan-don't-do,
  and this is the Notes override the convention requires. Refactors are not decisions with
  a build queued behind them; the decision is usually trivial and the work is the whole
  point. Tickets 01, 03, 06, 10, 12, 15, 16, 17, 18, 20 and 26 to 34 are execution. The
  grillings (02, 04, 05, 07, 08, 09, 11, 13, 14, 19) are genuine open decisions.
- **Verify before reasoning.** Every size and count on this map was measured on 2026-09-01
  and is written with that date. Re-measure before acting: `lib.ts` grew from ~25 import
  sites to 32 while sitting un-ticketed.
- **`pnpm typecheck` is the cheap check** and needs no server. Never stop the dev server.
- **The RTL flip has a one-line hold, and one landmine if you remove it wrongly**
  (2026-09-03, while the operator checks whether the reorder is wanted at all).
  [09](tickets/09-chrome-rtl-strategy.md) and [10](tickets/10-rtl-app-shell.md) are built
  and answered, but shipping them is a separate question from having built them, and this
  is what a session needs before touching either:
  - **The two halves are separate commits.** `c9e90a3` is the Urdu catalogue and the
    offer-set; `7b3205b` is the flip (`dir`, the Naskh font, the utility sweep). Neither
    was pushed on the day. They can be reverted independently.
  - **The sweep is inert under LTR.** `text-start`, `ms-`/`me-`, `ps-`/`pe-`, `start-`/
    `end-` render identically to the physical utilities they replaced when direction is
    left-to-right. Verified by computed style on the legal prose (`padding-left: 24px`
    under `en`, `padding-right: 24px` under `ur`) and by the full suite staying green.
    So the reorder costs existing users nothing unless `dir="rtl"` is actually set.
  - **The cheap hold is one line, not a revert.** Dropping `"ur"` from `LOCALES` in
    `src/i18n/config.ts` makes Urdu chrome unselectable, so `dir` is `ltr` everywhere and
    the flip goes dormant with all the work still in the tree. Reversible in both
    directions with one word. `src/i18n/config.test.ts` pins the exact offer-set, so it
    changes in the same commit or the suite goes red.
  - **The landmine: do NOT just delete the `dir` attribute** while keeping the sweep.
    Tailwind's `ltr:` variant compiles to an explicit `[dir="ltr"]` match, and the toggle
    knobs now carry `ltr:peer-checked:after:translate-x-4.5`. With no `dir` on `<html>` at
    all, neither the `ltr:` nor the `rtl:` rule matches and **every toggle knob silently
    stops moving** while still reporting the right checked state. Browsers defaulting to
    LTR does not save you: the attribute has to be present. Either keep
    `dir={langDir(locale)}` (it returns `"ltr"` for every non-RTL locale, so it is inert)
    or revert `7b3205b` whole.
  - **Two questions, separable, with different answers.** (a) Should Urdu chrome ship at
    all yet, given 709 LLM-drafted strings and no Urdu reviewer? That is a
    translation-quality call and it lives on the
    [translation-and-locales map](../translation-and-locales/map.md). (b) If it ships,
    should it be RTL? The operator answered **yes, full flip** on 2026-09-03, and the flip
    proved much cheaper than the pre-work estimate: no drawer slide to mirror (the mobile
    sidebar is a bottom sheet on `translate-y`) and no directional icons (the only chevron
    points down).
- **The measured Convex billing baseline lives here now**, at
  [assets/convex-cost-baseline.md](assets/convex-cost-baseline.md). It was
  `.plan/maps/technical-foundation/assets/convex-cost-baseline.md` until the 2026-09-01 consolidation folded that
  ticket-less map in. [01](tickets/01-slim-the-row-listlessons-collects.md) reasons from
  it, and a measurement is the one thing a later session cannot re-derive from the code.
  Its live fog is in this map's `## Not yet specified` below.
- Skills worth calling here: `ponytail` and `ponytail-review` (the laziest thing that
  works, usually the right size for a refactor), `codebase-design` (deep-module vocabulary,
  for the seam questions in 16 and 18), `convex-performance-audit` (for 01),
  `convex-migration-helper` (widen, migrate, narrow, for 01 and 06), `domain-modeling` (for
  07 and the ADR tickets), and `tdd` for anything touching the money rail.
- **One ticket stays behind on purpose**, the honest exception to this map's claim to hold
  all the technical work: `ui-overhaul/03` (Design foundation: tokens, components, tenant
  theming) overlaps [03](tickets/03-shadcn-foundation.md) heavily and is arguably the same
  job, but it sits three deep behind buying Mobbin Pro in a map about UX evidence.
  **Whoever resolves 03 here must reconcile the two**, or the second one to run will be
  wrong.
- **Correction, 2026-09-01 (same day, later session).** This map originally listed a second
  ticket staying behind: `course-publishing/11` (per-tenant `selling` flag), on the grounds
  that `course-publishing/14` (Catalogue query) is `blocked_by` it and moving 11 would have
  orphaned that edge. Both halves of that reasoning were wrong on inspection. **14 is
  resolved and shipped** (2026-07-28, ADR 0024), so its `blocked_by` no longer gates
  anything, and `tenant-feature-modularity/10` (Build: the selling switch) **explicitly
  absorbs 11** and says so in its own body. `course-publishing/11` is therefore resolved as
  a scope transfer, not moved here: the flag is a tenant switch, and the switch map owns it.
- `urdu-chrome-locale` kept only its message-catalogue ticket; its RTL spine is
  [09](tickets/09-chrome-rtl-strategy.md) and [10](tickets/10-rtl-app-shell.md) here.
- **Tickets 26 to 34 came from an architecture review dated 2026-09-04**, triaged in on
  2026-09-07. What a later session needs to know about that provenance:
  - **Every claim was re-verified in the tree on 2026-09-07 before its ticket was
    written**, and each ticket says so. The review is a source, not an authority, and it
    was already three days stale when triaged.
  - **The review's own top recommendation is not a ticket, because it was already
    fixed.** Its candidate 1 (the `as ProviderContext` cast that shipped every OpenRouter
    authoring prompt without its Frontier anchor and with the literal string `undefined`
    per Reference) was closed by `93d7e4b` on 2026-09-04, about three hours after the
    review was written. Do not go looking for it.
  - **The review correctly ruled four things out before scanning**, and that still holds:
    the Edition read surface is a reached destination in
    [edition-deepening](../edition-deepening/map.md) (all four tickets resolved), all five
    candidates of the earlier [architecture-deepening](../architecture-deepening/map.md)
    review landed, and `translate.ts`, `materialiseTopic` and boundary tests were already
    [24](tickets/24-split-translate-ts.md),
    [22](tickets/22-materialise-read-amplification.md) and
    [25](tickets/25-architecture-boundary-tests.md).
  - **Its six sub-card findings are in `## Not yet specified` below, not in tickets.**
    That was a triage call, made because none was sharp enough alone; the reasoning is
    recorded with them.
  - **Three tickets carry a live defect rather than only duplication**, which is why they
    are worth doing ahead of the rest: [26](tickets/26-one-publish-door-for-the-quiz-guard.md)
    (a shipping script bypasses the quiz-structure guard),
    [27](tickets/27-iframe-bridge-as-one-source-checked-module.md) (any frame on the page
    can post a fake quiz response and have it recorded) and
    [28](tickets/28-one-predicate-for-holding-an-edition.md) (`claimSeat` burns a capped
    seat on a member who already holds the Edition).

## Where the tickets came from

<!-- provenance, not status: chartr derives status from the ticket files -->

| # | Subject | Came from |
|---|---|---|
| 01 | Slim the translation row `listLessons` collects | `convex-cost/01` |
| 02 | Does the lesson body, and the quiz, come out of the iframe | `ui-overhaul/05` |
| 03 | Shadcn/ui foundation | `internal-course-studio/04` |
| 04 | The `/content` route is an open bearer URL | `marketplace/12` |
| 05 | Offline Lesson content, under a lease | `reader-experience/05` |
| 06 | Backfill anchor ids into existing References | `reader-experience/04` |
| 07 | Course co-authorship / ownership transfer | `course-management/03` |
| 08 | Review session management | `auth-sessions/02` |
| 09 | Decide the chrome RTL strategy | `urdu-chrome-locale/01` |
| 10 | Build: flip the app shell to RTL | `urdu-chrome-locale/03` |
| 11 | Off-peak scheduling for course generation | `course-authoring/05` |
| 12 | Cost instrumentation (tokens per Routine run) | `internal-course-studio/03` |
| 13 | Replace the committed USD to ZAR rate with a live one | `marketplace/05` |
| 14 | Supersede ADR 0016, the money model that shipped | `marketplace/09` |
| 15 | Record the ADR: Mux is the product-wide video rail | `media-generation/04` |
| 16 | Finish emptying `lib.ts` | new, was un-ticketed debt |
| 17 | Rename `lib.ts` to `edition.ts` | new, was un-ticketed debt |
| 18 | Split `convex/tenants.ts` | new, was un-ticketed debt |
| 19 | ADR 0014 is cited more narrowly than its scope | new, was un-ticketed debt |
| 20 | The 19 `ponytail:` markers have no ledger | new, was un-ticketed debt |
| 21 | Forgot-password flow (email OTP reset) | `auth-sessions/01` |
| 26 | One publish door for the quiz-structure guard | 2026-09-04 architecture review, candidate 2 |
| 27 | The iframe bridge as one source-checked module | same review, candidate 3 |
| 28 | One predicate for "does this caller already hold this Edition?" | same review, candidate 4 |
| 29 | One Ledger writer for the money event | same review, candidate 5 |
| 30 | Collapse the two bulk-seat rails onto one deal core | same review, candidate 6 |
| 31 | One model-call interface, two adapters | same review, candidate 7 |
| 32 | One mutation-run module behind the busy/error triples | same review, candidate 8 |
| 33 | One Reader Course module, two adapters | same review, candidate 9 |
| 34 | AdminPanel's pure cores, lifted out | same review, candidate 10 |

Tickets 22 to 25 were filed from this map's own fog and debt harvest (see their bodies).
Tickets 26 to 34 were triaged in on 2026-09-07 out of an architecture review dated
2026-09-04; see the Notes entry below for what that review was and which of its candidates
did **not** become tickets.

Ticket 21 arrived later the same day, in the consolidation that took `.plan` from 33 map
directories to 7 active maps. It joins [08](tickets/08-review-session-management.md), which
came out of `auth-sessions/02`: account recovery is a session question, and that map held
only those two tickets, so its directory is gone.

Tickets 16 to 20 were the **Follow-ups** section of the closed
[architecture-deepening](../architecture-deepening/map.md) map, plus one observation of this
session. That section is not a ticket file, so none of it was ever on any frontier: closing
that map made its own leftovers invisible. All five claims were re-verified in the tree on
2026-09-01 before being written up, and one had already gone stale (see 18).

## The dependency graph

Seven edges, and each one exists because doing the work in the other order wastes it.

```
02 iframe/quiz architecture  ->  03 shadcn foundation
04 /content bearer URL       ->  05 offline under a lease
09 RTL strategy              ->  10 RTL app shell
12 cost instrumentation      ->  11 off-peak generation
16 empty lib.ts              ->  17 rename to edition.ts
27 iframe bridge module      ->  33 Reader Course module
29 one Ledger writer         ->  30 collapse the bulk-seat rails
```

No frontier or blocked list is written here: both are derived, and the copy that used to
sit in this block was stale within days of being written.

- **02 to 03**: 02 decides whether the quiz becomes React. If it does, the component set
  must include quiz primitives, and a foundation built first is a foundation that cannot
  reach the highest-traffic surface in the product.
- **04 to 05**: a lease buys revocation. `/content` currently gives permanent
  unauthenticated read access to every lesson body anyone has opened, so until 04 decides
  whether that is accepted, 05 cannot know whether its whole mechanism is worth anything.
  05 asks this question itself.
- **09 to 10**: strategy before the sweep. 10 is the physical-property debt fix across the
  learner surfaces, and its size depends entirely on what 09 decides about the flip.
- **12 to 11**: the buffer-of-one gate exists as a deliberate cost throttle. Removing it
  for overnight full-course generation cannot be priced without per-run token numbers,
  which is what 12 builds. **This edge is new**, added at charting.
- **16 to 17**: the rename was explicitly declined until the file is emptied, because
  `edition.ts` would misname a junk drawer more precisely than `lib` does.
- **27 to 33**: 33's target shape has `ArtifactView` reduced to a frame owning no queries,
  and that frame is what 27 builds. Doing 33 first moves four message listeners into a
  shape 27 then re-cuts. **Added 2026-09-07 at triage.**
- **29 to 30**: both bulk rails reach the payout split through the shared ledger writer 29
  builds, so collapsing the mirror first means writing the shared deal module against five
  hand-assembled ledger rows and then rewriting it. **Added 2026-09-07 at triage.**

## Decisions so far

<!-- one line per resolved ticket -->

- [Chrome RTL strategy](tickets/09-chrome-rtl-strategy.md) 2026-09-03: the operator chose
  the **full flip** over shipping Urdu LTR first. `dir` comes from `langDir()` in the
  existing content-language registry rather than a second constant; the 73 physical
  utilities are one session, not a campaign; there is no icon-mirroring rule because
  there are no directional icons, only arrows living inside `en.json` strings; the chrome
  face is **Noto Naskh Arabic**, not Nastaliq, whose line-height would clip every
  fixed-height control; and acceptance splits layout (checkable by an English speaker)
  from translation quality (not claimed). Two findings shrank the job: the mobile sidebar
  is a bottom sheet on `translate-y`, so there is no drawer slide to mirror, and the
  lesson iframe is a separate document, so chrome `dir` cannot leak into an Edition.
- [Flip the app shell to RTL](tickets/10-rtl-app-shell.md) 2026-09-03: built in `7b3205b`.
  Verified in a browser on the public surfaces (landing and legal prose flip, fonts swap,
  LTR unchanged) and by unit test on the `langDir` seam. The authed surfaces and the
  chrome/lesson cross-pairs are **read-only verification**: the dev deployment has no
  `publicLinks` rows, so no Guest reader is reachable locally. See that ticket for the
  dev-versus-prod CLI trap that makes this look like a share-locale bug when it is not.
- [Record the ADR: Mux is the video rail](tickets/15-adr-mux-as-the-video-rail.md)
  2026-09-03: `docs/adr/0033`. Mux hosts all product video, marketing and learner-facing
  alike, displacing Convex file storage, unlisted YouTube, Cloudflare Stream and R2 plus a
  CDN. The ADR says plainly what drove it (momentum, on the strength of one 50 second
  clip) and what was **not** costed (the paid-marketplace economics). Its unlock criterion
  is Mux cost above 10 percent of the platform's net share of a course, which at the
  expected shape trips at roughly 1.3 watch-throughs per buyer or any course past about
  four hours. **Every figure in it is labelled estimated, not sourced**, and wants
  correcting by a superseding note rather than an edit.
- [The `ponytail:` markers have no ledger](tickets/20-ponytail-debt-ledger.md) 2026-09-03:
  `docs/ponytail-debt.md`. **20 markers, not the 19 the ticket claimed.** 19 accepted, 1
  needing a ticket after 23 closed the other, which has its own entry below. Three calls worth carrying: `content/publish.ts`'s global slug assumption is safe
  because `seedTopic` enforces uniqueness itself and `.unique()` fails loudly;
  `routine.ts`'s marker is **factually stale** (Lesson rows carry no HTML since the
  content-blob migration), which became ticket 22, still open, so it is named here as
  prose rather than linked;
  and `eft.ts`'s proposed hoist into `lib.ts` was **wrong**, because on this map `lib.ts`
  is a source and never a sink.
- [Finish emptying `lib.ts`](tickets/16-empty-lib-ts.md) 2026-09-03: 855 lines to **623**,
  48 exports to 30, 33 import sites to 16. Seven modules, not the four scoped:
  `shareGrants`, `tokens`, `authRedirect`, `contentBlobs`, `adminSecret`, `topicAccess`,
  and `sourceLang`. That last one was the enabling move, extracted first because the grant
  core reads `shareLang` which reads `SOURCE_LANG`, so leaving the constant behind would
  have made two modules import each other. The topic resolvers moved out too: they return
  `Doc<"topics">`, so their subject is the Topic row, and an `edition.ts` holding "give me
  the topic for this slug" is the misnaming 17 exists to avoid. No re-export shims.
- [Rename `lib.ts` to `edition.ts`](tickets/17-rename-lib-to-edition.md) 2026-09-04: 16
  import sites, halved by 16 from the 32 the ticket used to claim. `git mv` at 98 percent
  similarity, so `git log --follow` still reaches the history. No API path changed, because
  the file registers zero Convex functions and nothing referenced `api.lib.`, which is why
  it needed no deploy window. 26 files of prose repointed, three of them already stale
  before this ticket.
- [Split `convex/tenants.ts`](tickets/18-split-tenants-ts.md) 2026-09-04: 738 lines to
  **149**, 22 exports to 5, 97 of 186 `api.tenants.X` references repointed into
  `tenantTheme`, `tenantAssignment`, `tenantDonations` and a grown `tenantFlags`. 16's
  circular-import trap recurred as `normaliseEmail`, fixed by deleting a third private copy
  rather than minting a root module. **Seeding is deliberately not a module**: the
  secret-guarded twins moved with their pairs, because splitting two write paths that must
  never drift is worse than a long file. **This one did change 16 public `api.` paths**, so
  it carried a real deploy window.
- [Cost instrumentation](tickets/12-cost-instrumentation.md) 2026-09-04: `generationRuns`
  gains optional `inputTokens`, `outputTokens` and `model`, written as a set so **absent
  means unknown and never zero**, plus an admin-gated `tokenUsageByTopic`. The aggregate
  returns no single total on purpose: it reports `runs`, `runsWithoutUsage` and sums over
  measured runs only, so the number reads as a floor. **Only the OpenRouter seam reports
  real counts**; the cloud claude.ai Routine cannot, because Claude Code does not hand its
  totals to a shell it spawns, so most production runs are unmeasured until ADR 0014's
  runtime lands. No price, currency or cap anywhere. The admin list has **never been
  rendered for a human**.
- [Forgot-password flow](tickets/21-forgot-password-flow.md) 2026-09-04: an emailed
  8-digit OTP, `ResendOTPPasswordReset` over the existing Resend rail, no new dependency,
  and an email with no link or URL at all so there is nothing for Resend to wrap in a
  tracking domain. **Walked end to end on prod on 2026-09-04**, including the old password
  working before the reset and being refused after. The 2026-07-15 lockout is now
  self-service and the hand-set temp-password workaround is retired. Two unspecified
  behaviours recorded: a second code invalidates the first, and signing out drops the card
  back to the request step.
- [The tenant token mirror has no test](tickets/23-tenant-token-mirror-has-no-test.md)
  2026-09-04: two assertions in `src/design/tokens.test.ts`, no new file, no shared module.
  The lists had **not** drifted, so nothing was quietly fixed. `DEFAULT_TENANT_THEME` was
  covered as well, being a second hand-mirror of `globals.css` with the same blast radius.
  The lazy fix worked because a test can import across the Convex runtime boundary that a
  Convex function cannot, and the test was **proved able to fail** before being trusted.

## Not yet specified

<!-- in-scope fog: real, but not sharp enough to ticket. The test is whether the question
     can be phrased precisely now, not whether it can be answered now. -->

- **What the five `AdminPanel.tsx` tabs split into.** The file is **2667 lines**
  (re-measured 2026-09-07; it was 2617 on 2026-09-01 and grew by 50 while un-ticketed),
  still more than twice the next largest file in the repo (`ArtifactView.tsx`, 1141).
  **Half of this patch graduated on 2026-09-07** into
  [34](tickets/34-adminpanel-pure-cores-lifted-out.md): the pure cores and the chart
  primitive need nothing from 03 and can move now. What remains fog is the rest, the
  `{Allowlist,Sales,Payouts,Tenants,Generation}Tab` split, which still waits on
  [03](tickets/03-shadcn-foundation.md) settling the component vocabulary.
  `clears-with: 03`
- **Six sub-card findings from the 2026-09-04 architecture review**, all verified real by
  that review and all judged smaller than a ticket. Kept together because none is sharp
  enough alone and several may turn out to be one job:
  - **A tenant core.** Thirteen production `by_slug` fetch-else-throw prologues across
    five tenant modules with no `tenantBySlug`, though `topicAccess.ts:14-19` provides
    exactly that for Topics. `tenantBrand` exists as byte-identical private copies at
    `shares.ts:57` and `eft.ts:479` under a standing `ponytail:` note, and the
    secret-guarded and identity-guarded theme writes are one body twice
    (`tenantTheme.ts:85-105` and `:116-135`) where the guard wants to be a parameter.
    This is the closest of the six to being ticketable now.
  - **The dashboard's four course cards.** `pct` verbatim at `Dashboard.tsx:336,490,650`
    and the locale-else-en-else-first Edition chain verbatim at `:496,653,775`, one of
    them commented as mirroring the server's `preferred` with no test on either side.
  - **Five ways to seed a form from a live query**: a ref guard, a nullish chain, two
    `useState` initialisers, and a remount key imposed by the call site.
    `SharingTab.tsx:517-518` names the failure mode in its own words, a form that opened
    blank would silently withdraw the regional prices on every edit.
  - **Per-device state.** Thirteen key constants across nine files over `localStorage`,
    `sessionStorage` and cookies, with the sign-out sweep resting on an untyped prefix and
    `layout.tsx:136-137` admitting one cookie name is a literal inside an inline script
    that no rename tool can see.
  - **The orchestration protocol, twice.** `routine.ts` and `translate.ts` each implement
    the same stale window, acquire, fail-release, claim-with-heartbeat, report and
    fire-POST, with four of the six headers declaring themselves mirrors, and a counter bug
    fixed on the translation rail only. The review rated this *worth exploring* rather than
    *strong*, because the two lock tables and outcome vocabularies genuinely differ and the
    lift is not small. **Re-read this one against
    [24](tickets/24-split-translate-ts.md)**, which will move the translate half.
  - **Smaller repeats in the Convex read path**: the ready-translation-job-else-refuse gate
    written three times with the same error string, the lang-to-chip projection four times,
    and `shares.listSharedTopics` and `market.myPurchases` as the same 45-line card query
    over a different grant table.

  These are recorded rather than ticketed on purpose. The next session to touch any of the
  named files should fold the relevant one in rather than filing six tickets nobody picks
  up. No `clears-with:` on any of them: none has a plausible anchor on this map.
- **Six of the 30 ADRs are still `status: proposed`.** Two of the six are handled by name
  ([14](tickets/14-adr-superseding-0016-payfast-merchant-model.md),
  [19](tickets/19-adr-0014-citation-scope.md)). Whether the rest need a sweep, or whether
  "proposed" is simply how this repo writes a decision it has not built yet, is a question
  those two tickets will answer by example.
- **Where the unattributed Database I/O actually is.** The 2026-08-07 invoice billed 9 GB;
  the by-function breakdown accounts for 3.62 GB of it, filtered to prod. About **5.4 GB has
  no named cause**, which is larger than all three hot functions combined, and there are 9
  deployments on the account. Carried forward from the folded
  [convex-cost baseline](assets/convex-cost-baseline.md). Drill Database I/O per deployment
  before spending a session on [01](tickets/01-slim-the-row-listlessons-collects.md), or
  this map optimises the smaller half.
- **Whether moving deployments to a US region beats every optimisation on this map.** All
  deployments are EU-hosted, and EU usage cannot draw on the plan's included allowances, so
  every unit prices from the first one plus a 30% regional surcharge. US usage would draw on
  them: at this traffic that is a $0 bill, versus the cents 01 is worth. It is a
  configuration change, not a code change. Not free, since it moves data residency, which is
  a question about the courses' learners rather than about cost. Deliberately floating with
  no anchor: no ticket here sharpens it.
- **Whether the residual read scales with Editions or with readers.** The hot read is per
  (Topic, language), so each new Edition multiplies it, and
  [translation-and-locales](../translation-and-locales/map.md) is actively adding Editions.
  Which term dominates is unclear until more than one non-English Edition sees real traffic.
  `clears-with: 01`

## Out of scope

- **Feature work that merely needs a migration.** The scope test above is deliberate: a
  widen-migrate-narrow is not architecture work just because it touches the schema. This is
  why the per-tenant `selling` flag is not here; see the 2026-09-01 correction in Notes for
  where it went and why the original reason given was wrong.
- **Rewriting ADRs to correct them.** A stale ADR gets a superseding one; the original
  stands as the record of what was decided and when. Tickets 14 and 19 both operate under
  this constraint.
- **Performance work with no measurement behind it.**
  [01](tickets/01-slim-the-row-listlessons-collects.md) earns its place with a real billing
  number (1.16 GB of Database I/O in a month) and is honest that the saving is about
  $0.60/month. Anything without a number like that is not on this map.
- **The dev-tooling and observability signups** (`ui-overhaul/01` Mobbin, `ui-overhaul/07`
  PostHog) stay in `ui-overhaul`. They gate UX evidence, not code architecture.
- **Adding more sign-in providers.** Google shipped, with account linking by email.
  [21](tickets/21-forgot-password-flow.md) is recovery for the password path, not a new
  provider. Carried over from the closed `auth-sessions` map.
- **Undoing per-tenant session isolation**, which is a decided position. Carried over from
  `auth-sessions`, and it bounds [08](tickets/08-review-session-management.md): that ticket
  reviews session lifetime and repeat sign-in friction, not the isolation itself.
