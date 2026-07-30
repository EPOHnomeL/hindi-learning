---
type: grilling
blocked_by: [01]
---

# Language-scoped access & the user content-language

## Question

Surfaced resolving [ticket 01](01-model-self-enroll-grant.md) (2026-07-18): the user wants course
access scoped by a user's chosen **content language**. Split from the enroll mechanic (per-language
enrollment) and from full app-UI translation (a separate future effort) — this ticket is the
**access-policy + UX layer** in between. Gated throughout by the tenant **`translations`** flag (when
off: English-only, no picker, no greying-out). Decide, via `/grilling` (+ a `/prototype` pass for the
UI):

1. **The user content-language setting** — a new per-user field (none exists today). Allowed values,
   default, where it's set. Distinguish app-UI language (English for now) from the content/enroll
   language — this ticket owns only the latter.
2. **The access rule** — a member may access / self-enroll only in an Edition matching their content
   language; courses with no Edition in that language appear **disabled** (visible-but-locked). Pin
   what "disabled" permits vs forbids.
3. **Switching language** — can a member change content language, and what happens to courses already
   enrolled under the old one (grandfathered? hidden? still listed)?
4. **Interaction with the existing per-Edition model** — pricing, shares, public links, entitlements
   are already per-Edition; confirm this policy layers cleanly and doesn't contradict cross-language
   sharing.
5. **The UI** — an intuitive presentation of choosing/switching content language, the disabled
   cross-language cards, and the app-language-vs-content-language distinction.

## Done when

The content-language access policy and its UX are decided and recorded (feeding ticket 05 and the
PRD), with a Decisions-so-far line on the map.

## Answer

Resolved 2026-07-19 (`/grilling`) — **rescoped mid-session; the chartered premise was found obsolete.**
The user pointed out (and the codebase confirms) that **course-content translation already works and
is live**: the `translations` table, `convex/translate.ts`, and the reader's per-Edition switcher
already let any member read a translated Edition they have a grant to. Access is already per-Edition
via the four existing grants plus the new `enrollments` grant (ticket 01). There is **no missing
access-scoping layer** for content-language to add — the `users.contentLang` + disabled-card machinery
would have solved a non-problem.

**Dropped (do NOT build):**
- **No `users.contentLang` field** — no per-user setting, default, migration, `setContentLang`
  mutation, or picker.
- **No language-scoped *access rule*** — content-language does not gate access or self-enroll.
- **No "disabled / greyed-out" cross-language cards**, no "not available in your language" state, no
  request-translation affordance.
- **No content-language switching / grandfathering logic** — moot without the setting.
  (These were the ticket's original sub-questions 1–4 / the in-session Q1–Q6.)

**What survives — the thin enroll-language question ticket 01 left:**
1. **Per-card language pick, default English** — the catalogue card carries a small language control
   defaulting to English and listing the course's available translated languages. **Join
   self-enrolls the *selected* Edition** → one `enrollments` row.
2. **Want another language? Join again** — multi-language access is additive, idempotent per
   `(user, topic, lang)`, permanent/grandfathered (ticket 01 / ADR 0023). **No change to the enroll
   data model.**
3. **Every published course joinable in ≥ English** — no locked/disabled cards.
4. **Gated by the tenant `translations` flag** — off ⟹ no language control (English-only Join); on ⟹
   the control appears with the available translations. (Existing tenants default the flag `true`.)

**UI:** no `/prototype` pass (user decision) — the UI is a Join button + a language dropdown, spec'd in
words for [ticket 05](05-tenant-catalogue-surface.md) to render (native names from
`convex/languages.ts` `LANGUAGES`, English first/default).

**Per-Edition model layers cleanly** (sub-question 4): pricing, `shares`, `publicLinks`, `entitlements`
stay per-Edition and untouched; the thin resolution adds only a read-time language choice on the Join
affordance — no new grant type, no resolver change beyond ticket 01's `enrolled` branch.

**Spun off:** the user's actual current priority — **translating the app UI itself** (chrome; no i18n
framework today) — is promoted to **its own wayfinder effort/map**, explicitly out of scope for this
ticket and this map.
