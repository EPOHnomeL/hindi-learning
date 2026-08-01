# UI/UX Surface Inventory — hindi-learning (My Course)

<!-- Produced 2026-08-01 by the research subagent resolving
     .plan/maps/ui-overhaul/tickets/04-surface-inventory.md — committed verbatim. -->

Stack: Next.js 15 App Router (`src/app`), React 19, Tailwind v4 (`src/styles/globals.css`, `@theme` tokens only — no component library), Convex live queries, next-intl, per-host whitelabel tenancy (`src/middleware.ts` → `x-tenant-slug`).

Two facts that frame everything below:

- **There is no `components/ui` design system.** The only shared primitives live in `src/app/_components/ui.tsx` (350 lines: `IconButton`, `Dialog`, `Menu`, `MenuItem`, `ConfirmDialog`, three skeletons). Everything else — every button, input, card, tab, badge, pill — is bespoke Tailwind re-typed per surface. `rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hi hover:text-accent` appears dozens of times as literal duplicated class strings.
- **There is no PWA.** `public/` contains only `favicon.ico`, `icon.svg`, and a stray `editor-onboarding-demo.html`. No `manifest.json`, no service worker, no `next-pwa`, no `viewport` export anywhere, no `apple-*` meta. Mobile support is entirely ad-hoc `md:` classes; only 3 of 29 components use `sm:`/`lg:` at all.

---

## Learner-facing surfaces

### 1. `/` — Landing (signed out)
- **Files:** `src/app/page.tsx` → `src/app/_components/Landing.tsx` (206 lines); tenant override registry `src/app/_landing/registry.ts`, `src/app/_landing/YwamPotch.tsx` (174 lines).
- **What:** Marketing front door. Hero, "How it works" 3-step, 6-feature grid, live certificate showcase, embedded sign-in section. Same URL renders `Dashboard` when authenticated (`<Authenticated>`/`<Unauthenticated>` swap, no redirect).
- **UI state:** Best-looking surface in the app but entirely hand-rolled. Zero use of `ui.tsx`. Custom CSS animation classes (`.land-rise`, `.land-reveal`, `.cert-stage`) defined in `globals.css`; motion staggering via inline `style={{ "--d": "80ms" } as CSSProperties}` (3 occurrences). A local one-off `ThemeToggle` is defined inline — the *fourth* copy of that component (also in `CourseShell`, `PublicReader`, `YwamPotch`). `DemoCertificate` is mount-gated with a `useState`/`useEffect` hydration hack.
- **Mobile:** Reasonable. `sm:` ×9, `lg:` ×2 — hero type scale, `sm:grid-cols-3`, `lg:grid-cols-2`. Fluid, but no mobile nav pattern (nav is just brand + toggle + one link).

### 2. `/` — Tenant landing override (e.g. YWAM Potchefstroom)
- **Files:** `src/app/_landing/YwamPotch.tsx`, selected by `src/app/_landing/registry.ts`.
- **What:** A per-tenant bespoke landing page replacing `Landing` for one host.
- **UI state:** **Worst kind of smell — a hand-forked copy of `Landing.tsx`.** Same structure, same class strings, its own duplicate `ThemeToggle`, its own inline `--d` stagger styles. **Fully hardcoded English** (0 `useTranslations` calls) in an i18n app, plus hardcoded copy, email address, and a `PUBLIC_LINK` constant. Every new tenant means another fork.
- **Mobile:** `sm:` ×7, `lg:` ×1 — inherited from the fork; same profile as `Landing`.

### 3. `/` — Dashboard / library (signed in)
- **Files:** `src/app/page.tsx` → `src/app/_components/Dashboard.tsx` (959 lines).
- **What:** The learner home. Owned course grid, plus `SharedSection`, `PurchasedSection`, `AvailableSection` (the in-app catalogue/marketplace discovery), `NewCourseCard` (authoring entry), `EmptyLibrary`, settings gear, admin link, sign out.
- **UI state:** 959 lines, 13 components in one file. **Four near-identical card components** (`CourseCard`, `SharedCourseCard`, `PurchasedCourseCard`, `AvailableCourseCard`) each re-implementing the same `rounded-2xl border border-line bg-card` shell with slightly different pills (`StatusPill`, `PaidPill`, `LangChips`). `MissionDialog` is a bespoke `<dialog>` rather than the shared `Dialog`. The header's gear button and sign-out are raw `<button className="rounded-lg p-1.5 …">` rather than `IconButton`. Tenant logo via raw `<img>` with an eslint-disable. Loading state is a hand-rolled skeleton grid *inline* even though `DashboardSkeleton` exists in `ui.tsx` — and the two disagree (`bg-card` vs `bg-soft/20`).
- **Mobile:** Mediocre. `sm:grid-cols-2 lg:grid-cols-3` on grids, `md:` on header type sizes only. Header is a single `flex justify-between` row that will crowd badly on a narrow screen with a wide tenant logo + 3 actions. No drawer, no bottom nav.

### 4. `/courses/[slug]` — Course index (resume redirect)
- **Files:** `src/app/(app)/courses/[slug]/page.tsx`, `src/app/(app)/courses/[slug]/layout.tsx`, `src/app/_components/CoursePanes.tsx` (`CourseIndex`, `CourseStatus`).
- **What:** No real UI — computes the learner's resume lesson and `router.replace`s into it. Also the server chokepoint for the cross-host canonical redirect (`CrossHostRedirect`).
- **UI state:** Thin and clean, but `CourseStatus` carries three bespoke full-pane states with **literal emoji as iconography** (`📚`, `✍️`) next to an `icons.tsx` set that has proper SVGs, plus a hand-built three-dot bouncer using `[animation-delay:150ms]` arbitrary variants.
- **Mobile:** None (`sm:`/`md:` count = 0). States use `min-h-[60vh]` and centre; acceptable by accident.

### 5. `/courses/[slug]` — Course shell (persistent sidebar)
- **Files:** `src/app/_components/CourseShell.tsx` (591 lines).
- **What:** The reader frame: lesson/reference nav, resources section, progress ticks, edition/language switcher, theme toggle, course-settings entry, welcome panel, completion celebration, payment-return banner.
- **UI state:** The most load-bearing chrome in the app and largely bespoke. **Raw inline `<svg>` markup** for the back arrow and chevron instead of `icons.tsx`. Its own `ThemeToggle`, `LanguageSwitcher`, `CourseSettingsButton`, `ConfirmingBanner` all local. Nav item styling is at least extracted (`NavItem.tsx`), which is the exception. Client-only "seen replies" state hand-persisted to `localStorage` with try/catch. Sidebar is a 130-line JSX block with a 25-class conditional string.
- **Mobile:** **Genuinely the best-handled surface** — `md:` ×23. Sticky `h-12` top bar that hides on scroll (`useHideOnScroll.ts`), hamburger → bottom-sheet drawer with a grab handle, backdrop, `translate-y` transition, `overscroll-y-none`, `max-h-[80vh]`, route-change auto-close. All of it hand-written, none of it reusable.

### 6. `/courses/[slug]/lessons/[key]` — Lesson reader (+ quiz)
- **Files:** `src/app/(app)/courses/[slug]/lessons/[key]/page.tsx` → `CoursePanes.LessonPane` → `src/app/_components/ArtifactView.tsx` (999 lines) + `src/app/_components/lessonSrcDoc.ts` (485 lines).
- **What:** The highest-traffic learner surface. Renders AI-authored lesson HTML in a sandboxed iframe, records quiz responses, marks progress, hosts Q&A, next-lesson authoring, in-place prose editing, and the paygate for locked lessons.
- **UI state:** **The single biggest smell in the codebase.** The lesson *body itself is not React* — it is generated HTML injected into `srcDoc`, with three hand-written `<script>` string bridges (`HEIGHT_BRIDGE`, `QUIZ_BRIDGE`, `THEME_BRIDGE`) plus a `NAV_BRIDGE`, communicating via `window.postMessage` with a `__lesson: true` marker. **The quiz UI has no React surface at all** — it is `.quiz[data-correct]` / `.opt[data-k]` / `.quiz.fill[data-answer]` markup authored by the LLM, styled by CSS strings inside `lessonSrcDoc.ts`, with the answer bridge attaching click handlers by `querySelectorAll`. Correctness normalisation is duplicated between `lessonSrcDoc.ts` and the in-lesson `foot.html` visual layer, with a comment admitting they must be kept in sync. Theming is re-derived and injected as raw CSS (`buildTenantThemeCss`), and content height is round-tripped by postMessage to size the iframe. A hardcoded English string `"Mark complete"` sits on the mobile FAB in an otherwise fully translated app.
- **Mobile:** Most `md:` usage in the app (×32) and clearly thought about: sticky title bar that follows the hiding header (`transition-[top]`, `top-0`/`top-12`), Q&A rendered inline below the lesson on mobile vs an `md:w-80` right aside on desktop, a fixed bottom-right FAB for "Mark complete" that slides away on scroll. Justification is `@media (min-width: 641px)` inside the iframe CSS — a *different* breakpoint from Tailwind's `md` (768px), so the iframe and the shell disagree between 641 and 768px.

### 7. `/courses/[slug]/references/[key]` — Reference reader
- **Files:** `src/app/(app)/courses/[slug]/references/[key]/page.tsx` → `CoursePanes.ReferencePane` → `ArtifactView.ReferenceView`.
- **What:** Same iframe reader, no quiz, no Q&A column, no frontier/authoring controls.
- **UI state:** Shares `Frame`/`useContentHtml` with the lesson but re-implements its own title bar and edit affordance. `ReaderSkeleton({ aside: false })` is the shared bit.
- **Mobile:** Inherits `ArtifactView`'s handling; simpler because there is no aside.

### 8. `/share/[token]` (+ `/lessons/[key]`, `/references/[key]`) — Guest reader
- **Files:** `src/app/share/[token]/layout.tsx|page.tsx|lessons/[key]/page.tsx|references/[key]/page.tsx` → `src/app/_components/PublicReader.tsx` (474 lines).
- **What:** Ungated, token-credentialed public course reader for shared/marketing links. Anonymous progress in `localStorage`, `robots: noindex`, `referrer: no-referrer`. The funnel into checkout for tenant landing CTAs.
- **UI state:** **A near line-for-line duplicate of `CourseShell`.** Same sticky `h-12` header, same identical inline `<svg>` back arrow and chevron, same bottom-sheet aside with the same 25-class conditional string, same `useHideOnScroll`, its own fifth copy of `ThemeToggle`, its own `Centered` helper. Guest lesson/reference panes duplicate `ArtifactView`'s layout rather than reusing it, plus a bespoke `GuestQuestions` read-only Q&A list. The two shells will drift on any redesign.
- **Mobile:** Highest `md:` count in the app (×46) — mirrors `CourseShell` exactly, because it is a copy of it.

### 9. Paygate / checkout / EFT
- **Files:** `src/app/_components/Paygate.tsx` (365 lines) — `LockedPane`, `Paygate`, `BuyDialog`, `EftInstructions`.
- **What:** Locked-lesson paywall card, purchase summary dialog, PayFast hosted-checkout form POST, and a manual bank-transfer (EFT) rail with a reference number and pending-payment state. This is the money surface. (No donations feature exists — `grep -i donat` returns nothing across `src/` and `convex/`.)
- **UI state:** Bespoke. `BuyDialog` is a hand-rolled dialog, not the shared `Dialog`. The CTA style is extracted into a local `ctaClass` string constant and reused twice within the file — a micro design system of one. Error handling is per-component `useState<string|null>`, as everywhere else. The PayFast hand-off builds and auto-submits a signed form.
- **Mobile:** Barely — `md:` ×2, `sm:` ×1 (`p-4 md:p-8`, `p-6 sm:p-7`). The buy dialog inherits `w-[92vw]` only where it happens to use dialog conventions. For a payment flow that a phone learner will hit, this is the thinnest responsive treatment of any learner surface.

### 10. Sign-in / sign-up
- **Files:** `src/app/_components/SignIn.tsx` (176 lines). Rendered standalone by `AppGate` and embedded as the `#get-started` section of both landings.
- **What:** Email+password and Google OAuth, sign-in/sign-up toggle, "last used" pill, buy-intent copy variant, terms/privacy consent.
- **UI state:** Entirely bespoke: hand-inlined `<GoogleMark/>` SVG, raw `<input className="rounded-lg border border-line …">` ×2, three differently-styled buttons, a hand-built "or" divider (`<span className="h-px flex-1 bg-line" />`). Uses `grid min-h-screen place-items-center` even when embedded inside a landing section, so the section is forced to a full viewport height. Hydration worked around with a mount effect for the last-used pill.
- **Mobile:** **Zero responsive classes** (`sm`/`md`/`lg` all 0). Survives only because `max-w-sm` is already phone-width. `min-h-screen` (not `min-h-dvh`) means iOS toolbar jitter.

### 11. Account settings dialog
- **Files:** `src/app/_components/SettingsDialog.tsx` (129 lines), plus `LocalePicker.tsx` (guest-only variant) and `ThemeContext.tsx`.
- **What:** Display name, app language, light/dark — opened from the dashboard gear.
- **UI state:** One of the few surfaces built on the shared `Dialog`. Still hand-rolls its input, save button with a 3-state label, a language list, and a segmented light/dark control that is a *sixth* independent theme-toggle implementation.
- **Mobile:** None (0 breakpoints). Relies on `Dialog`'s `w-[92vw] max-w-lg`.

### 12. Course settings dialog (learner/owner mixed)
- **Files:** `src/app/_components/CourseSettings.tsx` (369 lines) — `DetailsSection`, `EditionDetailsSection`, `LessonsSection`, `CompletionSection`; pulls `EmblemSection` from `Certificate.tsx`.
- **What:** Title/mission editing (per-edition), lesson list management, certificate emblem, mark-course-complete.
- **UI state:** Uses shared `Dialog` and `ConfirmDialog` — good — but every section inside is a bespoke form with its own dirty/saving/saved state machine repeated four times.
- **Mobile:** **Zero breakpoints.** A four-section settings stack at `max-w-lg` with `max-h-[80vh]` scroll; usable but untuned.

### 13. `/certificate/[token]` — Public certificate
- **Files:** `src/app/certificate/[token]/layout.tsx|page.tsx` → `src/app/_components/Certificate.tsx` (822 lines).
- **What:** Anonymous token-credentialed certificate view, with print-to-PDF and share. Also the in-app claim flow, completion confetti, emblem picker, and the demo card on the landing.
- **UI state:** The most elaborate and most *bespoke* CSS in the repo. **~55 hand-written CSS classes in `globals.css`** exist solely for this one artefact (`.cert-card`, `.cert-doc`, `.cert-doc-weave`, `.cert-doc-seal::before`, `.cert-corner--tl/tr/bl/br`, `.cert-sheen`, `.cert-glow`, `.cert-shine`, `.cert-stage::before/::after`, `.cert-medallion`, `.cert-enter`, …) — roughly 400 of `globals.css`'s 689 lines. Mouse-tilt implemented by mutating CSS custom properties in `onCardMove`/`onCardLeave` handlers with a manual `prefersReducedMotion()` check. Confetti via `canvas-confetti`. Print layout depends on `mm` units under `@media print`, with a dedicated regression test (`styles/globals-cert-freeze.test.ts`) guarding it — i.e. the CSS is understood to be fragile.
- **Mobile:** Almost none — `sm:` ×2 in the whole 822-line file, no `md:`. The certificate is a fixed-aspect document scaled by a `--u` unit; it will be tiny or overflow on a phone. `.cert-stage` atmosphere is heavy for mobile GPUs.

### 14. Welcome / first-open panel
- **Files:** `src/app/_components/Welcome.tsx` (115 lines), `welcomeDerive.ts`.
- **What:** First-visit orientation modal in both readers, with a "start at lesson N" CTA.
- **UI state:** Clean — built on `Dialog` + `IconButton` + `Icon`. Closest thing to a well-composed surface in the app.
- **Mobile:** `md:` ×1 (heading size). Fine by virtue of being a dialog.

### 15. `/terms`, `/privacy`, `/refunds` — Legal
- **Files:** `src/app/(legal)/layout.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `refunds/page.tsx`.
- **What:** PayFast/POPIA compliance pages: T&Cs, privacy policy, refund & cancellation policy.
- **UI state:** Prose styled by **one 400-character arbitrary-variant Tailwind string** on the `<article>` (`[&_h1]:text-2xl [&_h2]:mt-8 [&_p]:mt-3 [&_ul]:list-disc hover:[&_a]:underline …`) — a hand-rolled `prose` plugin. **Not whitelabeled and not translated:** the header hardcodes `"My Course"` and `support@my-course.app`, and every page is hardcoded English, so a tenant's Spanish learner sees the wrong brand and the wrong language on the page they must accept to buy.
- **Mobile:** Zero breakpoints; saved by `max-w-3xl px-6`.

### 16. Auth gate / cross-host redirect / loading chrome
- **Files:** `src/app/_components/AppGate.tsx` (26), `CrossHostRedirect.tsx` (21), skeletons in `ui.tsx`.
- **What:** Wraps `(app)` group; shows `Dashboard`/`Course` skeletons while the session resolves, then `SignIn`; bounces off-canonical hosts client-side.
- **UI state:** Small and fine. The skeletons are the app's one real shared-component win — though `Dashboard` ignores them and inlines its own.
- **Mobile:** Skeletons carry `md:`/`sm:` mirroring their targets.

---

## Authoring / studio surfaces

### 17. New course composer
- **Files:** `NewCourseCard` inside `src/app/_components/Dashboard.tsx` (~lines 770–959), `useResourceUpload.ts`, `ResourceItem.tsx`.
- **What:** The entire authoring entry point — title, "why", provider choice (Claude/OpenRouter), resource links + file uploads. Expands in place from a card into a form inside the dashboard grid.
- **UI state:** A ~190-line inline form crammed into a 2-column grid cell, with 8 `useState`s, its own link-draft sub-editor, and fire-and-forget background uploads (`void (async () => …)` with nested try/catches). Exposes a raw LLM-provider toggle to end users. Should be a dialog or a route; it is a card.
- **Mobile:** Nothing specific — it inherits the grid cell, so on a phone the whole composer is one narrow column.

### 18. Lesson/reference in-place content editor
- **Files:** `ContentEditor` in `src/app/_components/ArtifactView.tsx` (~lines 603–710).
- **What:** Owner/editor WYSIWYG: a modal iframe rendering the authored document with `designMode = "on"`, reading `body.innerHTML` back on save, splicing it into the source doc and uploading a new content blob.
- **UI state:** **`document.designMode` contentEditable-on-an-iframe** is as bespoke as editing gets — no editor library, no toolbar, no undo model. Trigger is a hover-revealed pencil (`md:opacity-0 md:group-hover:opacity-100`).
- **Mobile:** **Effectively broken on touch** — the affordance is hover-only on desktop (`md:`), forced always-visible on mobile, but `designMode` editing on a phone has no toolbar and no keyboard affordances.

### 19. Editions / translations / publishing / selling dialog
- **Files:** `src/app/_components/Editions.tsx` (1274 lines) — `EditionsDialog`, `EditionPicker`, `EditionPanel`, `InviteByEmail`, `AccessRoster`, `AccessRow`, `PublishToggle`, `PublicLinkToggle`, `PayoutDetailsForm`, `SellEdition`, `RetryTranslation`, `RemoveEdition`, `EngineToggle`, `EditionDangerMenu`, `RegenerateLinkConfirm`, `RemoveEditionConfirm`, `RetranslateConfirm`, `AddLanguagePanel`, `EmptyPanel`.
- **What:** The whole studio in one modal: add language editions, choose translation engine, publish, mint/regenerate public links, invite viewers/editors by email, manage the access roster, set a price and payout bank details, sell, retranslate, delete.
- **UI state:** **1274 lines and 21 components in a single file, all inside one `Dialog`.** Four separate hand-built confirm dialogs (`RegenerateLinkConfirm`, `RemoveEditionConfirm`, `RetranslateConfirm`, plus `EditionDangerMenu`) despite `ConfirmDialog` existing in `ui.tsx`. Its own listbox/combobox (`EditionPicker`) with filtering, its own badge system (`EditionBadges`), its own skeleton (`EditionsDialogSkeleton`), its own empty state (`EmptyPanel`), its own segmented control (`EngineToggle`). Pricing, payout bank details, and access control — three genuinely different mental models — share one modal body.
- **Mobile:** `sm:` ×2 (one of which just hides the "Add language" button label), `md:` ×0. A 1274-line control surface inside a `max-w-lg` dialog on a phone.

### 20. `/admin` — Sys-admin portal
- **Files:** `src/app/(app)/admin/page.tsx` → `src/app/_components/AdminPanel.tsx` (**2255 lines, ~46 components in one file**).
- **What:** Five tabs — Allowlist, Sales, Payouts, Tenants, Generation. Includes: allowlist management, a day-bucketed stacked sales chart with legend and hover tooltips, per-course sales rows, an EFT confirmation queue, operator bank details, seller grants and payout rows, generation-run history and "generating now", tenant CRUD, and a full **tenant theme editor** (JSON palette import, 14-token light/dark colour fields, live preview).
- **UI state:** **The worst file in the repo.** 2255 lines, no file split. **Zero i18n** — every string hardcoded English in an app with five locale files. Uses `window.confirm` via a `confirm_()` wrapper for destructive operations. Hand-built SVG-less charts: absolutely-positioned `<div>`s with `style={{ height: \`${h}px\` }}`, `style={{ bottom: \`${(t/top)*100}%\` }}`, `style={{ background: s.color }}` (7 inline-style sites), a CSS-only `group-hover` tooltip, and a 3px minimum-bar hack. Its own `TabButton` and a *separate* `ModeButton` for the theme editor's light/dark tabs, with a comment explaining why they couldn't share. Palette validation logic (`coerceImportedTheme`, `validatePalette`) duplicated client-side from the server's `assertThemeTokens`, acknowledged in a comment.
- **Mobile:** `md:` ×9 (mostly `md:py-12` / `md:text-3xl`), `sm:` ×1. Five tabs in a `flex-wrap` strip, wide data tables, colour-token grids, and a bar chart with a fixed `H = 160` px plot — none of it usable on a phone.

### 21. `/admin` — Tenant-admin panel
- **Files:** `TenantDetail` inside `AdminPanel.tsx`, reached when `myAdminScope.role === "tenant"`.
- **What:** A tenant admin's locked-down view of their own tenant: branding, theme, courses. Same route, entirely different page.
- **UI state:** Shares all of `AdminPanel`'s problems (English-only, inline styles, bespoke controls) and adds a role-branching `if` at the top of a 2255-line file as its only routing.
- **Mobile:** Same as above — effectively desktop-only.

---

## Cross-cutting

| Concern | State |
|---|---|
| Shared primitives | `ui.tsx` only (350 lines, 8 exports). Used by ~6 of 21 surfaces. |
| Icons | `icons.tsx` (156 lines) exists — but `CourseShell`, `PublicReader`, `SignIn`, `ArtifactView` inline raw `<svg>`, and `CoursePanes` uses emoji (`📚`, `✍️`, `🎓`). |
| Theme toggle | **Six independent implementations** (`Landing`, `YwamPotch`, `CourseShell`, `PublicReader`, `SettingsDialog`, plus the iframe `THEME_BRIDGE`). |
| Confirm dialogs | `ConfirmDialog` in `ui.tsx`, plus 4 bespoke ones in `Editions.tsx`, 1 in `ArtifactView` (`QaDialog`), 1 in `Dashboard` (`MissionDialog`), and `window.confirm` in `AdminPanel`. |
| Forms | No form abstraction. Every input is a repeated `rounded-lg border border-line bg-card px-3 py-2 focus:border-gold` literal; every save is a local `"idle"｜"saving"｜"saved"` machine. |
| Design tokens | `src/design/tokens.ts` (131 lines, 14 tokens) → `buildTenantThemeCss` → pre-paint `<style dangerouslySetInnerHTML>` in `app/layout.tsx`, plus a hardcoded inline cookie-regex script with a comment warning it can't be renamed safely. Tokens cover colour only — no spacing, radius, or type scale, which is why radii are typed by hand (`rounded-[10px]`, `rounded-[11px]`, `rounded-xl`, `rounded-2xl`) with no rule. |
| i18n coverage | `AdminPanel.tsx` (2255 lines) and `YwamPotch.tsx` (174 lines): **0 translation calls**. All three legal pages: hardcoded English. One leaked literal `"Mark complete"` in the lesson FAB. |
| Responsive/PWA readiness | No `manifest.json`, no service worker, no `viewport`/`themeColor` export, no `apple-touch-icon`, no offline story. `min-h-dvh` used in newer code, `min-h-screen` in `SignIn`/`Landing`. Breakpoints used: `md:` almost exclusively; `sm:` in 6 files; `lg:` in 4; `xl:` never. |
| Breakpoint conflict | Shell uses Tailwind `md` = 768px; the lesson iframe's justification CSS uses `@media (min-width: 641px)`. Layouts disagree between 641–768px. |

---

## Priority order

Worst-first, weighing code smell × learner traffic × mobile weakness (mobile weighted up, since a PWA effort follows).

1. **Lesson reader + quiz (`/courses/[slug]/lessons/[key]` — `ArtifactView.tsx` + `lessonSrcDoc.ts`)** — highest-traffic learner surface in the product, and its core interaction (the quiz) lives outside React entirely as LLM-authored HTML wired up by four hand-written `postMessage` script strings; a PWA cannot own offline, theming, or touch behaviour through an opaque sandboxed iframe.
2. **`/admin` sys-admin portal (`AdminPanel.tsx`)** — 2255 lines, 46 components, zero i18n, `window.confirm`, div-based charts with 7 inline-style sites, and effectively unusable on a phone; the worst code in the repo by every measure, and the tenant theme editor inside it is what every whitelabel launch depends on.
3. **Editions / publishing / selling dialog (`Editions.tsx`)** — 1274 lines and 21 components stuffed into one `max-w-lg` modal with four bespoke confirm dialogs and essentially no responsive treatment; it is the entire studio and the entire selling flow, and it is the surface most likely to block a tenant from shipping.
4. **Paygate / checkout / EFT (`Paygate.tsx`)** — the money path, with the thinnest mobile treatment of any learner surface (`md:` ×2) and a hand-rolled buy dialog outside the shared `Dialog`; every ZAR flows through it and most buyers arrive from a phone via a share link.
5. **Guest reader (`/share/[token]` — `PublicReader.tsx`)** — a 474-line duplicate of `CourseShell` (identical inline SVGs, identical drawer, fifth `ThemeToggle`) that is simultaneously the top-of-funnel for every marketing link; leaving it forked guarantees the redesign lands twice or drifts.
6. **Dashboard / library + catalogue (`Dashboard.tsx`)** — the signed-in home for every learner, 959 lines with four duplicated card components, an inline skeleton that contradicts the shared one, and a header that will crowd on narrow screens; also hosts the 190-line authoring composer that should not be there.
7. **Certificate (`Certificate.tsx` + ~400 lines of `globals.css`)** — the app's marketing centrepiece and reward moment, built on ~55 one-off CSS classes, mouse-tilt custom-property mutation, and mm-based print rules guarded by a freeze test; `sm:` ×2 and no `md:` means it is close to unusable on the phone most learners will finish a course on.
8. **Course shell (`CourseShell.tsx`)** — best mobile work in the app but 591 bespoke lines with inline SVGs and its own toggle/switcher/banner; it must be reworked in lockstep with #5 to collapse the fork, and it frames every reading session.
9. **Sign-in / sign-up (`SignIn.tsx`)** — every learner passes through it, it has **zero responsive classes** and uses `min-h-screen` (iOS toolbar jitter), and it is force-embedded at full viewport height inside both landings.
10. **New course composer (`NewCourseCard`)** — the sole authoring entry point, a 190-line 8-state form living inside a grid cell with fire-and-forget uploads and a raw LLM-provider toggle exposed to users; low traffic, high abandonment risk.
11. **In-place content editor (`ContentEditor`)** — `document.designMode` on an iframe with no toolbar, gated behind a hover-only pencil; effectively unusable on touch, but authoring is a small audience.
12. **Tenant landing override (`YwamPotch.tsx`)** — a hardcoded-English hand-fork of `Landing.tsx`; fix the pattern (make tenant landings data-driven) before the second fork exists, but it is currently one page for one tenant.
13. **Course settings + account settings dialogs (`CourseSettings.tsx`, `SettingsDialog.tsx`)** — already on the shared `Dialog`, but zero breakpoints between them and four repeated save-state machines; moderate traffic, cheap to fix once form primitives exist.
14. **Landing (`Landing.tsx`)** — the best-looking surface and adequately responsive; needs deduplication against the tenant fork and extraction of `.land-*`/`.cert-stage`, not a redesign.
15. **Legal pages (`(legal)/*`)** — visually fine, but hardcoded `"My Course"` + `support@my-course.app` breaks whitelabeling and they are English-only on the consent path to purchase; a content/tenancy fix more than a UI one.
16. **Course index / status states (`CoursePanes.tsx`)** — small, mostly a redirect; only needs the emoji swapped for real icons and the bespoke bouncer replaced.
