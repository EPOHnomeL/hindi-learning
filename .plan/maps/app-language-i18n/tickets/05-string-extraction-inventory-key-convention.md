---
type: grilling
blocked_by: [04]
---

# Learner-surface string inventory and key-naming convention

## Question

With the layer locked (04), define **how learner-facing hard-coded English strings become keys**:

- **Inventory** the hard-coded chrome strings across the in-scope learner surfaces — the reader
  (nav, "Next lesson", "References", "Ask a question", progress labels), the dashboard, the catalogue
  frame, and the learner auth/checkout. (Ticket 01 cites `CourseShell.tsx:175-202` as one nest; the
  inventory should be broad enough to size the work, not necessarily exhaustive to the last string.)
- **Key-naming convention** — the namespace/key shape (matching whatever 04 chose), and the rule that
  **English is the source of truth** for keys.
- **Extraction approach** — mechanical sweep vs. as-you-touch, and where the English source strings
  land (the source catalogue/dictionary).
- **Interpolation & edge cases** — strings with variables/counts (ties into the pluralization fog),
  and strings currently built by concatenation that must be restructured into a single key.

Output: the extraction convention + a sized inventory, ready to hand to a build. Keep it ponytail —
convention first, not a giant find-replace PR.

## Done when

A key-naming convention (namespace shape + English-source rule), a chosen extraction approach, the
interpolation/concatenation rules, and a sized inventory of the in-scope learner surfaces are all
recorded and ready to hand to a build.

## Answer

Resolved 2026-07-20 (extraction/inventory session). Mostly a `task` documenting a convention behind the
settled `next-intl` + repo-JSON layer, wrapped around two genuine forks put to the user (HITL); both
landed on the recommended option. No exhaustive find-replace was done — this sizes and specs the build.

**Fork 1 (decided) — key namespace shape → namespace by surface.** `messages/en.json` is a nested object
keyed by learner surface, matching `next-intl`'s `useTranslations('<Surface>')` grain. Top-level
namespaces: **`Common`** (cross-surface atoms: `signOut`, `back`, `loading`, `save`, `cancel`, generic
errors); **`Reader`** (course shell: `lessons`, `references`, `nextLesson`, `askQuestion`, progress
labels, `preparingFirstLesson`, `noLessonsYet`, `backToCourses`); **`Dashboard`** (landing/workspace:
title, empty states, theme-toggle labels); **`Catalogue`** (catalogue *frame* strings only — the
content-language join is 06's); **`Auth`** (sign-in / create-account / checkout Paygate chrome + errors);
**`Editions`** (in-reader Edition switcher *frame*: `Source`, `Translating`, `Failed`, `Add a language`
— content-language half again 06's). Rules: **English (`en.json`) is the source of truth for keys** — a
key exists iff it is in `en.json`, every other file mirrors that key set exactly (enforced below); **key
names are semantic, not English-derived** (`Reader.nextLesson`, not `Reader.next_lesson_button`) so
re-wording English never renames a key. Rejected: flat dotted keys (loses `useTranslations` scoping) and
per-component namespaces (brittle).

**Fork 2 (decided) — extraction approach → bounded mechanical sweep.** One focused build pass extracts
all in-scope learner-surface strings at once (the ~8 components below), replacing hard-coded English with
`t()` / `getTranslations` and populating `en.json`. Rationale: scope is already bounded; as-you-touch
would leave chrome visibly half-English (reads as a bug). `en.json` authored in the sweep; non-English
files LLM-drafted-offline-then-reviewed per 04 decision 3. Ponytail guard: convention-driven, not
speculative — extract only strings that actually render on in-scope surfaces; do not pre-key
admin/authoring/studio (out of scope).

**Interpolation, counts & concatenation.** Absorbed into `next-intl`'s ICU format (pluralization resolved
at 04): variables → ICU placeholders (`"Welcome, {name}"`, `t('greeting', { name })`); counts → ICU
plural, one key (`"{count, plural, one {# lesson} other {# lessons}}"` — how "N of M lessons" lands, not
string math); concatenation restructured into one key — in `CourseShell.tsx`, `<span>←</span> Courses` and
`{l.seq}. {l.title…}` keep the arrow/number as JSX/data, only "Courses" (→ `Reader.backToCourses`) is a
key; Paygate sentences like *"This reference is part of the full course"* become **one** key, never
assembled from fragments.

**Key-parity check (re-homed fog item — specced & closed here).** Per 04's Downstream, catalogue staleness
is a build-time key-parity check owned here. Spec (ponytail — reuse the existing `vitest` runner): a test
(e.g. `messages/parity.test.ts`) reads `en.json` and every other `messages/<code>.json`, flattens each to
its set of leaf key-paths, and asserts each non-English set **equals** English's, failing with
missing/extra keys per file. Runs in the normal `pnpm test` / CI gate — **CI fails on drift**. English is
the reference set. **Not** a runtime `sourceHash`, **not** a Convex rail (04 rejected both). Optional
nicety (not required): assert ICU placeholder-name parity per key so a translator can't drop `{name}`;
ship the key-set check first.

**Sized inventory** (enough to size the build, not exhaustive; from a noise-filtered `Grep` sweep):

| Surface | Component(s) | ~Strings | Namespace |
|---|---|---|---|
| Reader shell | `CourseShell`, `CoursePanes`, `NavItem`, `ResourceItem` | ~25 | `Reader` (+`Common`) |
| Edition switcher frame | `Editions` (frame only) | ~10 | `Editions` |
| Dashboard / workspace | `Dashboard` | ~30–40 | `Dashboard` |
| Catalogue frame | catalogue browse/enroll chrome (`Dashboard`/landing) | ~10 | `Catalogue` |
| Checkout / paygate | `Paygate` | ~9 | `Auth` |
| Auth | `SignIn` | ~12 | `Auth` |
| Footer / legal chrome | `SiteFooter` | ~4 | `Common` |
| Public reader | `PublicReader` | ~20 | `Reader` |

**Total ≈ 90–120 keys** across ~8 components — a single bounded PR, not a platform migration. The
`CourseShell.tsx:175-202` nest ticket 01 flagged is inside the ~25 Reader strings.

**Escape hatch reminder (from 04):** Hindi/Devanagari chrome needs the app-shell font to mirror the
reader's `Noto_Serif_Devanagari` handling (`src/app/layout.tsx`) — the `Spectral` shell font has no
Devanagari glyphs. Not a string concern, but the sweep's acceptance QA must catch it.

**Downstream:** fog item "catalogue staleness / key-parity" → **closed** (specced above; remove from the
map's "Not yet specified"). Boundary held: 05 owns extraction + key convention + key-parity check;
storage/picker = 03; catalogue content-language join = 06.
