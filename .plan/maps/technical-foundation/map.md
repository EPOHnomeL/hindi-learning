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
  point. Tickets 01, 03, 06, 10, 12, 15, 16, 17, 18, 20 and 26 to 37 are execution. The
  grillings (02, 04, 05, 07, 08, 09, 11, 13, 14, 19, 38) are genuine open decisions.
- **Two tickets are PART built and stay open (2026-09-08).** They are named here rather
  than in `## Decisions so far`, which may only index tickets with an `## Answer`. Each
  ticket's own body records what landed and what is left, so neither is re-done from
  scratch:
  - [33](tickets/33-one-reader-course-module.md): the dead notification-dot machinery is
    gone (`unseenReplyKeys` had zero callers, `NavItem.notify` was never passed, the seen
    set fed no renderer), which took `myQuestions` out of `CourseShell` with it, and
    `docs/adr/0036` supersedes ADR 0012's seen-set half. The `useReaderCourse()` collapse
    itself is untouched: it is the highest-traffic surface with zero component tests, so it
    wants its own session and a browser walk.
  - [37](tickets/37-what-crosses-the-lesson-boundary.md): the one breakpoint is built, two
    rules deep so it actually moves on the 441 stored lessons. The light-mode token bridge
    is not, and the reason is recorded: it repaints reading material and wants a human
    looking at a real lesson. The ticket's "only the 14 contract vars" claim was already
    stale and is corrected at the seam.
- **Delivery mode, 2026-09-08:** tickets 26 to 36 landed on a branch and a PR
  (`t3code/improve-codebase-architecture`) rather than as trunk commits, because the
  operator asked for one PR carrying a whole `/improve-codebase-architecture` run. That is
  a deviation from this repo's trunk-based convention, scoped to that request.
- **Verify before reasoning.** Every size and count on this map was measured on 2026-09-01
  and is written with that date. Re-measure before acting: `lib.ts` grew from ~25 import
  sites to 32 while sitting un-ticketed.
- **Prod row counts, measured 2026-09-07** on `capable-barracuda-769` (eu-west-1):
  **441** `lessons` rows with a body, **84** `references`, **1476** `translations`.
  This corrects the "~1400 lessons" figure that [02](tickets/02-lesson-quiz-architecture.md)
  and its `ui-overhaul` ancestor both carried: 1400 was the *translations* number.
  Anything reasoning about the cost of touching every lesson should reason about 441.
  The read route is in `docs/agents/project-context.md` and it is the only one an agent in
  this checkout has — there is still no prod deploy key here.
- **The by-function dashboard read LANDED 2026-09-09**, supplied by the operator as
  screenshots, and it re-ranks this map's cost thread. Full table, period derivation and
  caveats in [the baseline](assets/convex-cost-baseline.md). The short version:
  `capture.myQuestions` is **fixed** (1.15 GB/month to 530 KB) and `listReferences`
  largely so (1.13 GB/month to 4.25 MB), both by `784eb70`; `listLessons` is **not**,
  and is now 40.7% of the deployment's I/O; **`public.publicCourse` is a new #2 at
  24.2% and 257 KB per call**, which nothing owned and
  [01](tickets/01-slim-the-row-listlessons-collects.md) has been widened to cover,
  because the sibling-table split fixes all three and a kinds-narrowing fix would miss
  it entirely. Compute and Data Egress have collapsed to nothing. The window is about a
  day and a half, so **composition is reliable and monthly projections are not.**
- **Two cost questions remain OPERATOR-GATED, not un-worked (2026-09-09).**
  Written here so no further session re-opens them, re-plans them, or quietly builds
  around them. Each needs a Convex **dashboard** read, and a session in this checkout
  cannot do any of them: verified 2026-09-09 that the Convex CLI exposes no usage or
  billing command (`npx convex --help`), and there is still no prod deploy key here.
  - **Read the Aug 8 to Sep 8 2026 invoice.** It closed on 2026-09-08 and nobody has
    read it. It is the first closed bill that fully contains `784eb70`, so it is the
    first real test of that change, and it may move several numbers in
    [the baseline](assets/convex-cost-baseline.md).
  - **Drill Database I/O per deployment** to find the unattributed ~60% (the fog patch
    below). **Partly answered 2026-09-09 and the leading hypothesis got weaker:** within
    the `my-course` project non-prod is negligible (Dev 660.7 KB of 166.97 MB, 0.4%), so
    "it is the non-prod deployments" no longer looks likely. What is still unseen is the
    other projects on the account.
  - **Decide EU versus US hosting** (the fog patch below). This one may end the cost
    thread outright.

  Until they are answered, **do not start a session on cost-motivated code.** The whole
  bill is $3 to $4 a month, Compute and Egress have collapsed to nothing, and 01 is
  worth about $0.60 of it, so the user-experience
  argument is the only one that survives contact with the number. That is the framing
  [38](tickets/38-cache-a-course-toc-on-the-device.md) is filed under.
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
| 35 | A publish-time validator for an orphaned quiz answer key | the answer to 02 |
| 36 | `pnpm bundle:authoring` has been broken since 2026-08-27 | the answer to 02 |
| 37 | What crosses the lesson boundary: tokens, and one breakpoint | the answer to 02 |
| 38 | Cache a course's table of contents on the device | the 2026-09-09 Convex-cost handoff, section 6 |

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

Eight edges, and each one exists because doing the work in the other order wastes it.

```
02 iframe/quiz architecture  ->  03 shadcn foundation
04 /content bearer URL       ->  05 offline under a lease
09 RTL strategy              ->  10 RTL app shell
12 cost instrumentation      ->  11 off-peak generation
16 empty lib.ts              ->  17 rename to edition.ts
27 iframe bridge module      ->  33 Reader Course module
29 one Ledger writer         ->  30 collapse the bulk-seat rails
36 repair bundle:authoring   ->  37 what crosses the boundary
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
- **36 to 37**: 37 has to edit `lessons/_partials/head.html`, and the bundler that carries
  that partial into the authoring prompt currently throws. Shipping a partial edit through
  a dead bundler changes what future lessons look like without changing what the model is
  told to author. **Added 2026-09-07 with 02's answer.**

## Decisions so far

<!-- one line per resolved ticket -->

- [Does the lesson body, and the quiz, come out of the iframe](tickets/02-lesson-quiz-architecture.md) 2026-09-07: **no, and that is now decided rather
  than tolerated** — `docs/adr/0035`. The quiz does not become React and no structured quiz
  data is introduced: the answer key stays in the authored HTML and the server never scores,
  because quiz correctness here is **deliberately self-reported formative data** that gates
  no certificate, no money and no access. So the third sub-question answers **neither**:
  no migration and no compatibility path, and the 441 published lessons are untouched.
  The prose stays in the iframe and `allow-scripts`-without-`allow-same-origin` is a
  permanent boundary. One breakpoint, **768px**, matching Tailwind `md`. The design system
  reaches a lesson **only as CSS custom properties**, across the bridge
  `injectTenantPaletteCss` already provides. This **narrows**
  ticket 03 — no quiz primitives, lesson interior out of scope —
  and the narrowing is written into 03's own body. Three build tickets were filed rather
  than folded in, because a resolved decision ticket on this map renders as *shipped*; they
  are named in 02's own Answer. **Not done, deliberately:** the `e.source` guard stays with
  27, and no behavioural measurement was taken — reopening server-side scoring would need
  those numbers first, and a superseding ADR rather than an implementation.

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
- [`pnpm bundle:authoring` has been broken](tickets/36-repair-bundle-authoring.md)
  2026-09-08: the authoring contract moved to `lessons/AUTHORING.md`, out of the
  skills-CLI-managed directory that deleted it. The other five teach docs stay pointed at
  the skill on purpose, because copying them here would manufacture the drift the bundler
  prevents. The real fix is that the bundle is one function, `bundleAuthoringAssets`, so
  the suite runs the bundler instead of only its renderer: the old test stayed green for
  eleven days while `pnpm bundle:authoring` could not start. Regenerating folded in twelve
  days of frozen skill drift. **Unblocked 37.**
- [One publish door for the quiz-structure guard](tickets/26-one-publish-door-for-the-quiz-guard.md)
  2026-09-08: `convex/quizGate.ts`, with `quizVerdict` returning ok/mismatch/unreadable so
  the unreadable case is named rather than left to six callers to remember. The dead branch
  in `publishTranslation` is **deleted, not commented**, and the mutation is
  `internalMutation`, so `publishTranslationChecked` and `translateTopic` are the only
  doors. The test that pinned the bypass open was rewritten. `topics/_devanagari/publish.ts`
  could not be repointed: `topics/` is gitignored and absent from this checkout.
- [A publish-time validator for an answer key that names no option](tickets/35-publish-time-quiz-answer-key-validator.md)
  2026-09-08: `unresolvableAnswerKeys` in the same gate, refusing at BOTH publish paths
  before the row exists, because a Lesson is immutable (ADR 0003) and the only repair is a
  republish. A referential check on the markup, not scoring, so ADR 0035 stands. The tests
  read the contract off `lessons/AUTHORING.md` and the script off `foot.html`, and one pins
  that ADR 0019's shuffle can never invalidate a key.
- [One Ledger writer for the money event](tickets/29-one-ledger-writer-for-the-money-event.md)
  2026-09-08: `convex/moneyEvent.ts` owns the split, the cents check, the insert, the ITN
  idempotency and the shared purchasable-Edition gate. The EFT rail's regained cents check
  has a test **proved to fail without it**. `splitNet` left `payfast.ts`, which is the
  gateway wire format and never was its home, and a boundary assertion fails if a rail
  imports it again. **Correction:** the ticket's claim that the `eft.ts:59` `ponytail:`
  marker anticipated this writer is wrong. That marker is bank-details validation and its
  trigger has not fired; `docs/ponytail-debt.md` records it.
- [Collapse the two bulk-seat rails](tickets/30-collapse-the-two-bulk-seat-rails.md)
  2026-09-08: `convex/bulkDeal.ts` takes the five shared mechanisms; each rail keeps only
  what ADR 0031 says differs, each difference named at the seam. **No superseding ADR**, and
  the Answer says why: 0031 named this cost rather than deciding it, and every substantive
  constraint of it still stands. No behaviour change, evidenced by 43 existing tests passing
  unmodified.
- [One predicate for holding an Edition](tickets/28-one-predicate-for-holding-an-edition.md)
  2026-09-08: `convex/grants.ts` owns the four grant tables with `grantEdition` and
  `revokeEdition` as the only writers, and each predicate stays as cheap as the copy it
  replaced. The Catalogue listing trio moved to `publishedEditions.ts` to keep the edge
  one-way, which is 16's and 18's circular-import trap avoided rather than re-met.
  **Correction:** the ticket's claim that `claimSeat` wrote a duplicate Entitlement row is
  wrong. It cannot, because the seat account is minted per (code, nickname). The guard went
  in anyway; **it was not a live defect.** `CONTEXT.md` records that nothing writes an
  `enrollments` row any more.
- [One model-call interface, two adapters](tickets/31-one-model-call-interface-two-adapters.md)
  2026-09-08: `convex/modelCall.ts`. The question the ticket refused to let us assume is
  answered: the policy **is** genuinely identical, and every difference is wire format, now
  named per adapter. One real behavioural difference was kept and made explicit rather than
  flattened (`sendsReasoningControl`). `geminiComplete` returns usage like its sibling, and
  Gemini's thought tokens count as output because that is how they are billed. Translation
  usage is deliberately **not persisted**: that is schema work on `translationJobs` and its
  own ticket. ADR 0014 honoured, not reopened; 19 not touched.
- [One mutation-run module behind the busy/error triples](tickets/32-one-mutation-run-module.md)
  2026-09-08: `mutationRun.ts` with `refusalTag`, `refusalMessage` and `useMutationRun`. All
  four copies of the unwrap gone. **Ten silent call sites, not the seven the review counted**
  (it missed `SharingTab`'s two toggles and `ManageShell`'s generation control), and two of
  them were worse than silent, reporting success for a refused write. Writing the tests
  found **two latent defects** in the copy being made shared: object `ConvexError` data
  printed as raw JSON, and an empty message rendering as nothing at all. Only the pure half
  is tested, and the ticket's own instruction to check first is why: there is no
  `.test.tsx` in the repo and no React testing environment.
- [AdminPanel's pure cores, lifted out](tickets/34-adminpanel-pure-cores-lifted-out.md)
  2026-09-08: `adminDerive.ts` and `dayStackChart.tsx`, 2660 lines to 2489.
  `validatePalette`'s six refusals each have a test, which was the whole point. Checked
  against the server as the ticket required: the mirror has **not** drifted, and the two
  differences are intentional. The five-way tab split stays out of scope, so the
  `AdminPanel.tsx` fog patch stays open on 03.

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
- **1194 `translations` rows carry inline `html` with no blob**, measured on prod
  2026-09-07 by the same walk that produced the row counts above (`stranded` in
  `backfill:verifyHtmlBlobs`). Against 272 blob-only and 10 matched, that is most of the
  table. Two readings, and this session could not tell them apart: either the content-blob
  migration reached `lessons` and `references` (441 and 84, **all** blob-only) and never
  finished on `translations`, or inline is simply how a translation body is meant to be
  stored — `tenantBackfill.setTranslationInlineHtml` exists and writes exactly that.
  Whichever it is, the two tables disagree and nothing in the tree says which is intended.
  Recorded rather than ticketed because the question is *which shape is correct*, and that
  is a decision, not a defect. No `clears-with:` — no ticket here sharpens it.
- **`certificates.myCertificate` is the chattiest function in the deployment** (measured
  2026-09-09): 1.1K prod calls plus 298 dev, well above `listLessons`'s 441 and above
  every other line. Cheap per call at 7 KB, so this is a **function-calls** question,
  not an I/O one, and function calls were 15% and $0.66 of the baseline bill. The cause
  is structural rather than a defect: `CertificateChip` mounts its own
  `useQuery(api.certificates.myCertificate)` per course card
  (`src/app/_components/CourseCardParts.tsx:97`), so one dashboard load fans out one
  live subscription per card. Recorded rather than ticketed because the fix is the same
  denormalise-onto-the-card shape as the dashboard N+1 that the baseline already ruled
  **out of scope by measurement**, and at this traffic it is worth cents. Fold it in if
  a session is already in `CourseCardParts` or the dashboard queries. No `clears-with:`.
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
