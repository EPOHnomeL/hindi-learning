# Findings — docs & tracker reconciliation against git history

**Swept:** 2026-07-29 · **Frontier:** `ef12177` (`main`) · Brief: [HANDOFF.md](HANDOFF.md)

Method: read the diffs (not the subjects) from `bfb21f4` (2026-07-27) forward, then
verified each doc claim against code. Where a claim needed prod state that isn't
readable from this machine, that is said explicitly rather than guessed.

---

## 1. Doc corrections made (committed)

| File | What was wrong | Now |
|---|---|---|
| `docs/agents/project-context.md` §Payments | Said the live PayFast merchant was **pending FICA** and selling "should be paused (`PAYFAST_MODE=off`)" — as of 2026-07-17 | FICA cleared; the rail is **live with 5 real purchases**. The `off` instruction is marked retired. Added: dev runs `sandbox`; prod Convex env is unreadable from this machine (see §5) |
| `docs/agents/project-context.md` §Repo gotchas | Named the *design-family* skills (banner-design, brand, design, design-system, slides, ui-styling, ui-ux-pro-max) as the real dirs under `.claude/skills` | Those seven exist in **neither** tree and were never git-tracked. Replaced with the verified real-dir list, and the `teach` drift is now recorded |
| `docs/agents/project-context.md` §Repo gotchas | *(nothing — new)* | Added the **misattributed-commits** warning with two confirmed examples, so `git blame` in the 07-27→07-29 window isn't trusted |
| `CONTEXT.md` **Admin** | "The **single** User who governs the Allowlist… **Exactly one Admin exists**" | Rewritten as the shipped two-tier model (sys admin / tenant admin, `myAdminScope`, `isCallerAdmin(ctx, tenantSlug?)`) |
| `CONTEXT.md` **Public link** | "read-only access to a single **Topic**" | Corrected to a single **Edition** — `publicLinks` rows are keyed `(topicId, lang)`, so one Topic can have several links, revocable independently |
| `CONTEXT.md` **Entitlement** `_Avoid_` | Told the reader enrollment was "the deferred per-learner-progress concept" | Enrollment is built (ADR 0023); the cross-reference now points at the new term |
| `CONTEXT.md` — new terms | Glossary had **no** entry for the central whitelabel concepts | Added **Tenant**, **Feature flag**, **Enrollment** |
| `.scratch/whitelabel/TODO.md` | Per-tenant dark palettes untick­ed; landing registry unticked; "**Prod Convex is not deployed by the Vercel build**" | Dark palettes and the registry ticked with commit refs; the infra claim struck through as **false** (see §2); theme-editor item closed |
| `.scratch/whitelabel/README.md` | "17 local implementation issues… current work is building those" + a live "single Admin is debt" note | Marked **v1 built** (07–24 all landed); the Admin-singleton note marked resolved; flagged the `almighty-warrior` → `almighty-warriors` slug typo |
| `.scratch/i18n-sweep-edition-default/PRD.md` | No status; named the cookie `hindi_locale` | Marked **shipped** (all 9 issues) and flagged the `hindi_lang` / `hindi_mode` rename per ADR 0025 |

### The one direct doc-vs-doc contradiction, resolved

`.scratch/whitelabel/TODO.md` claimed *"Prod Convex is not deployed by the Vercel
build (`build` is just `next build`)"*; `project-context.md` claimed the build command
is `npx convex deploy --cmd 'pnpm run build'`. **`project-context.md` is right.** The
TODO reasoned from `package.json`, but Vercel's project-level build command overrides
it. Verified in the `ef12177` production build log:

```
06:48:09  Running "npx convex deploy --cmd 'pnpm run build'"
06:48:10  ▌ [Production] …:hindi-learning:production (prod)
06:48:10  ▌ └─ https://capable-barracuda-769.eu-west-1.convex.cloud
06:48:11  > next build
```

So **pushing `main` does deploy prod Convex**, no manual `convex deploy` is needed,
and the handoff's own "pushing `main` deploys prod" gotcha is accurate.

---

## 2. Issue verdicts — propose only, nothing closed

All 53 open issues. **No `gh issue close/comment/edit` was run.**

### Shipped — recommend closing (14)

| # | Title | Evidence |
|---|---|---|
| 113 | welcome/01: first-open welcome panel | `9fde7fd` → `3578e93` → `da02161` (became a modal); `src/app/_components/Welcome.tsx`, `welcomeDerive.ts` |
| 99 | rich-media/11: Resource links | `readerDerive.ts` `resourceTarget()` (`412b776`), href pinned through translation (`db5dbf4`), term in `CONTEXT.md` |
| 72 | 09 — fill af/es/fr/hi + parity green | all five `messages/*.json` carry **395** keys, real values, 14 namespaces |
| 71 | 08 — course settings edits the UI-locale edition | `src/app/_components/CourseSettings.tsx:10-18` — dialog self-resolves the target Edition from `lang` |
| 70 | 07 — open-course defaults to the UI-locale edition | `Dashboard.tsx:486-488, 587-588, 689-690` (`openLang` via `useLocale()`); `CoursePanes.tsx:21` |
| 69 | html-blob-storage/05: drop inline `html` | `convex/schema.ts:163-174` — "legacy inline `html` was dropped after every row was migrated" |
| 68 | edition-deepening/04: collapse content/public onto one core | `c89fb03`; map closed by `52e692e` |
| 65 | course-translation/02: mission translated but never read | now read — `convex/public.ts:89-92` serves the Edition's mission; `welcomeDerive.missionExcerpt()` renders it |
| 53 | admin-sales/02: Sales + Payouts tabs | `AdminPanel.tsx:61,69-73,88-91` — `SalesManager` / `PayoutsManager` |
| 52 | admin-sales/01: `sales.report` query | `convex/sales.ts:17` |
| 50 | Knowledge grilling: diagnostic mode + "teach me that" handoff | `.agents/skills/grill-my-knowledge/SKILL.md:7` — examiner mode, answer withheld, "output is a gap list to hand to `/teach`" |
| 47 | Review session management | `b886a38` — `src/lib/sessionLifetime.ts`, `convex/auth.ts`, `src/middleware.ts`. **Caveat below** |
| 87 | reference-cards/04: backfill anchor ids | Not built — but its own body says *"deferred (parked — do NOT build with 01–03)"*, product decision 2026-07-19. Close as `wontfix`, or keep purely as a parked note |
| 73 | internal-course-studio/01: reader-visibility gate (draft → publish) | **Superseded**, not built as written. Per-Edition **Publishing** (ADR 0024, `publishedEditions`, `catalogue.setEditionPublished`) is now the reader-visibility gate, at a different grain than this ticket assumed |

**#47 caveat before closing:** browser-restart persistence is fixed, but ADR 0025 made
sessions **per-subdomain** — a user who uses two tenant brands now signs in twice *by
design*, and the cutover signed everyone out once. If the reporter's complaint was
about that, #47 isn't done; it's a different issue.

### Partially shipped — recommend re-scoping (5)

| # | Title | What landed / what's left |
|---|---|---|
| 85 | progress-feature/01 | **Landed:** resume-last-read (`readerDerive.resumeLessonKey`, used by `CoursePanes` + both readers), quiz answers per user (`responses` table). **Missing:** the in-lesson **progress bar** — no percentage/bar component exists |
| 100 | scheduled-authoring/01: off-peak scheduling | **Landed:** `convex/crons.ts` fires `routine.dailyFire` at 04:23 UTC, explicitly "off-peak, off-`:00`". **Missing:** the ticket's actual ask — *overnight full-course* generation (many lessons per run), not the buffer-of-one top-up |
| 66 | course-translation/03: RTL chrome + re-translate affordance | **Landed:** `dir: "ltr" \| "rtl"` plumbed through `ArtifactView` (6 call sites) and snapshotted on certificates. **Unclear/missing:** the re-translate affordance for *partially-ready* Editions — the redo machinery exists in `convex/translate.ts:220-239` but is driven by an engine switch, not by partial readiness |
| 79 | marketplace-discover/01 | **Landed but at odds with the ask.** The **Catalogue** shipped (`d944a3b`, `e57ded2`, ADR 0024) — but deliberately as an *available-courses section on the signed-in home*, **never a public page**, while this ticket asks to "add to the landing page". `CONTEXT.md` **Catalogue** records that as a decision. Either close as superseded or re-scope to the public-discovery half |
| 74 | internal-course-studio/02: "share with the company" + draft-gating | Its stated blocker ("needs issue 01") is gone — draft-gating now exists as per-Edition Publishing. The entry point itself isn't built. Re-scope against ADR 0024 |

### Still open — verified not built (32)

`#112`, `#111` (see §3 — the commit lies), `#108`, `#106` (`topics.ownerId` still
single-owner), `#105`, `#104`, `#103` (no `not-found.tsx` or `error.tsx` anywhere under
`src/app`), `#102`, `#101`, `#88`, `#86`, `#84`, `#83`, `#82`, `#81` (no reset/forgot
path in `convex/` or `src/`), `#80`, `#78`, `#77`, `#76` (zero shadcn/radix/cva deps in
`package.json`), `#75` (`generationRuns` records outcome + timing, **no token fields**),
`#67`, `#64`, `#63`, `#62`, `#61` (no `deleteTopic`/`removeTopic` anywhere), `#60`,
`#59`, `#58`, `#54`, `#51`, `#48` (no copyright-scan skill in `.agents/skills/`), `#45`.

### Needs a human decision (2)

- **#46 "Improve Onboarding Flow"** — body is one line: *"This should be as smooth as
  possible."* No scope, no acceptance criterion, and the surface has since moved under
  it (open sign-up, auth-first checkout, the welcome modal, per-tenant sessions).
  Either grill it into a real PRD or close it; it cannot be worked as written.
- **#44 "Implement PWA" vs #86 "pwa/01: Implement website as PWA"** — duplicates.
  #86 has no body; #44 carries the actual want (offline download + not re-entering
  credentials). Keep **#44**, close #86 as a duplicate — but note the credential half
  overlaps #47, and offline reading conflicts with paid-Edition gating (`entitlements`
  are checked server-side), which is undecided.

---

## 3. Misattributed history — confirmed, and worse than the handoff said

Two commits verified by diff:

| Commit | Subject claims | Diff actually contains |
|---|---|---|
| `792a20a` | "feat(auth): **implement Google sign-in** and improve session persistence" | **One file: `.scratch/google-signin/PRD.md`** (+176). No provider, no button, no code. `convex/auth.ts:26` still has `providers: [Password({…})]` only |
| `02aedcb` | "feat(publish): publishedEditions table + owner-only publish mutations" | Also carries the **tenant-admin scoping** work — `convex/tenants.ts` +109 and `tenants.test.ts` +145 |

**`792a20a` is the expensive one.** Anyone reading `git log` concludes Google sign-in
shipped; it did not, and **#111/#112 are genuinely open**. #111 is the harder half —
it documents that a second provider without email-linking gives an existing password
user a *second `users` row on the same email*, losing purchases, progress, certificates
and shares. On a rail that now handles real money, shipping #112 before #111 is a data
incident, and the commit log currently suggests both are done.

Session-persistence *was* real, but it landed separately in `b886a38`.

**Recommendation:** do **not** rewrite history (no `--amend`, no rebase — the handoff
forbids it and `main` is deployed). The durable note now lives in
`project-context.md` §Repo gotchas. The root cause is mechanical, not careless:
concurrent sessions share one git index, so `git commit --only <paths>` is the fix
already in `CLAUDE.md` — it just wasn't used in that batch.

---

## 4. ADR mismatches — reported, not acted on

`docs/adr/` was **not** edited. Supersession hygiene is genuinely good (0002→0009,
0004-6→0007, 0008 partial, 0011 partial, 0022 §4a→0025, 0024 supersedes the
course-level publish grain). Two gaps:

1. **ADR 0016 is the real one.** `0016-paid-course-marketplace-stripe-connect-facilitator.md`
   is still `status: proposed` and titled *"Sellers sell, platform facilitates via
   **Stripe Connect** (**not** merchant of record)"*. The shipped reality is the exact
   inverse on both counts: **PayFast**, with the operator as **sole merchant of
   record**. Stripe appears nowhere in `convex/` or `src/` except two mentions inside
   `convex/payfast.ts` / `payfast.test.ts`. The pivot's only record is
   `.scratch/payfast-payments/PRD.md` — a scratch file, not a decision record.
   **Recommend a new ADR superseding 0016**, especially now that the rail is live.
2. **A manual-EFT ADR is already planned but unwritten** —
   `.scratch/ywampotch-launch/issues/06-adr-manual-eft-rail.md`. Flagging so it doesn't
   get skipped, since it would touch the same money path as (1) and the two should
   probably be sequenced together.

Neither ADR 0022's tenant model nor 0025 nor 0023 nor 0024 contradicts current code.

---

## 5. Facts I could not verify (stated, not guessed)

- ~~**Prod Convex env vars**~~ — **resolved, and the footgun is the finding.**
  `npx convex env get PAYFAST_MODE --prod` answers **`sandbox`** while printing
  *"Ignoring `--prod` … using deployment from `CONVEX_DEPLOY_KEY`"*: the dev key in
  `.env.local` wins over the flag, and the output looks exactly like a prod answer.
  `.env.local` also holds `PROD_CONVEX_DEPLOY_KEY`, so prod **is** readable by
  passing the key instead of the flag:

  ```sh
  CONVEX_DEPLOY_KEY="$PROD_CONVEX_DEPLOY_KEY" npx convex env get PAYFAST_MODE
  # → live
  ```

  **Prod `PAYFAST_MODE` is `live`**, confirming the corrected Payments section from
  the deployment's own config rather than from the handoff. Both the value and the
  method are now in `project-context.md`.
- **The 5 purchases** are asserted, not counted by me — real data lives only on prod.
  Corroborated in-repo by `.scratch/ywampotch-launch/issues/00-ywampotch-launch-map.md`
  ("PayFast itself is live and working (5 real purchases)"), which is independent of
  the handoff.
- **Vercel `NEXT_PUBLIC_CONVEX_URL`'s trailing slash** — env vars aren't readable from
  the repo. Left open in the whitelabel TODO, now marked un-re-verified.
- **Browser verification of each tenant host** (whitelabel 11/13) — needs a browser.
- **`#85`'s "save last read"** — resume logic is verified in code; whether it satisfies
  the reporter's intent (per-course, across devices) wasn't checked against prod data.

---

## 6. Two trackers — the overlap

`CLAUDE.md` says issues live on GitHub. Reality: **74 GitHub issues (53 open)** and
**149 local issue files** across 57 `.scratch/*/issues/` directories.

The raw gap is misleading, so here is the shape rather than a number:

- **Most local files are historical, not backlog.** `whitelabel/01–24`,
  `payfast-payments/01–06`, `i18n-sweep-edition-default/01–09`,
  `auth-first-checkout/01–07`, `edition-deepening/00–04`,
  `architecture-deepening/00–05`, `generation-observability/01–04`,
  `translation-cost/01–05`, `translation-engine-picker/01–04`,
  `app-language-i18n/00–06` are **shipped work with their maps closed**. They read as
  an archive and should be treated as one.
- **Some are on GitHub under a title the tooling can't match.** `#70`/`#71`/`#72` are
  titled `"07 — …"`, `#80` is `"01 — …"`, `#50` drops the prefix entirely. Any
  prefix-matching reconciliation script will report these as local-only. They aren't.
- **Genuinely local-only and genuinely open — one cluster:**
  **`.scratch/ywampotch-launch/`** (PRD + 9 tickets, `00`–`08`). It is the current live
  feature — funnel fixes plus a **manual EFT rail** on a money path — and it is
  invisible to `gh issue list`. This is the real cost of the split, not the archive.
  **Update, mid-sweep:** it was untracked (`?? .scratch/ywampotch-launch/`) when this
  sweep started, but a **concurrent session committed it as `7ab47ad`** while the sweep
  ran. So it is now in the repo — but still not on GitHub, so the `gh`-invisibility
  half stands.
  Also local-only: `admin-allowlist/01` (a prod ops follow-up),
  `landing-page/01`, `rich-media/01` and `/10` (scoping notes for shipped or
  GitHub-tracked work), `edition-title-edit/01–02`, `invite-emails/01–03`,
  `multi-topic/09`, `lesson-estimate/02` — all shipped or superseded.

**Recommendation (not acted on):** GitHub for anything actionable; `.scratch/<feature>/`
for PRDs, maps and scoping prose only — which is what `CLAUDE.md` already says. Two
concrete steps, both yours to authorise:

1. **File `.scratch/ywampotch-launch/`'s 8 tickets on GitHub.** (Committing the
   directory is already done — `7ab47ad`, by a concurrent session mid-sweep.) It is
   in-flight work on the live payment path, and the tracker `CLAUDE.md` points at
   cannot see it. Highest-value, lowest-risk step.
2. **Mark the archive as archive** — one `STATUS: shipped` line at the top of each
   closed feature's `README`/map (several already have this). Cheaper and safer than
   migrating or deleting 100+ files, and it makes the remaining backlog legible.

No migration was performed.

---

## 7. Other drift found, not fixed

- **`teach` skill drift — found, then fixed.** Both trees hold a *real directory*
  (neither is a symlink), so they drift silently.
  `.claude/skills/teach/SKILL.md` was **188** lines and
  `.agents/skills/teach/SKILL.md` **142**, missing exactly three sections:
  **"Terminating a Course"**, **"Choosing the Emblem"**, **"The Lesson-Count
  Estimate"**. Since the **Routine reads `.agents/`**, unattended runs were authoring
  without the course-termination, Emblem and lesson-count guidance that **ADR 0017**
  (Emblem) and **ADR 0018** (lesson-count estimate) describe as Routine behaviour —
  including how to *end* a course at all.

  This report first called the fix a content decision. That was wrong, and a byte
  comparison settled it: normalising line endings (`.agents` is CRLF, which is why a
  plain `diff` reports every line changed and hides this), `.claude` is a **strict
  superset** — identical to `.agents` apart from one contiguous 46-line insertion at
  line 83. Nothing had been edited in both directions, so there was no authorship
  call to make, only a lagging copy.

  **Merged** the block into `.agents/skills/teach/SKILL.md`, preserving its CRLF
  endings; the two files are now content-identical at 189 lines. The inserted block's
  references were checked rather than assumed: `MISSION-FORMAT.md`, `AUTHORING.md`,
  ADR 0017, ADR 0018 and `docs/routine-prompt.md` all resolve from
  `.agents/skills/teach/` (same depth, so `../../../` is unchanged), and the CLI it
  instructs the Routine to call is real — `--image`/`--glyph` in `scripts/complete.ts`
  and `--estimate` in `scripts/report.ts`.

  **The standing hazard remains:** these are two files, not a symlink like every other
  shared skill. Edit one, edit the other. Making `.claude/skills/teach` a symlink into
  `.agents/` would remove the hazard permanently, but that is a tooling change beyond
  this sweep's remit — recommended, not done.
- **`.scratch/whitelabel/README.md`** says the tenant is `almighty-warrior`; the slug
  everywhere else is **`almighty-warriors`**. Flagged inline; not renamed.
- **`docs/agents/domain.md`** hasn't been touched since `6256d01` ("init commit",
  2026-06-09) — 7 weeks and 25 ADRs ago. Nothing in it read as *false*, so it was left
  alone, but it predates tenancy, Editions, publishing and the payment rail and is
  worth a deliberate read rather than a sweep's guess.
- **`.scratch/whitelabel/issues/00-whitelabel-map.md`** carries the handoff's own
  warning that it "decays every session". Issues 07–24 are all shipped, so the map is
  now archive; its `TODO.md` sibling is the live document. Left as-is per the
  don't-migrate constraint.
