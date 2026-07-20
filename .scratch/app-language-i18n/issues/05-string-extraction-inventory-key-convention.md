# app-language-i18n/05: Learner-surface string inventory and key-naming convention

**Status:** done
**Claimed:** 2026-07-20 (ticket-05 extraction/inventory session)
**Labels:** wayfinder:grilling
**Depends on:** 04
**Parent:** [00 — Chrome i18n map](00-app-language-i18n-map.md)

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

## Resolution — 2026-07-20 (extraction/inventory session)

Type gut-check (per handoff): the architecture is locked, so this is **mostly a `task`** —
documenting a convention behind the settled `next-intl` + repo-JSON layer — wrapped around **two
genuine forks** that were put to the user (HITL). Both landed on the recommended option. The
re-homed fog item (**key-parity check**) is specced here, closing it. No exhaustive find-replace was
done; this sizes and specs the build, per ponytail.

### Fork 1 (decided) — key namespace shape → **namespace by surface**

`messages/en.json` is a **nested object keyed by learner surface**, matching `next-intl`'s
`useTranslations('<Surface>')` grain. Top-level namespaces:

- **`Common`** — cross-surface atoms: `signOut`, `back`, `loading`, `save`, `cancel`, generic errors.
- **`Reader`** — the course shell: `lessons`, `references`, `nextLesson`, `askQuestion`, progress
  labels, `preparingFirstLesson`, `noLessonsYet`, `backToCourses`.
- **`Dashboard`** — the learner landing/workspace: title, empty states, theme-toggle labels.
- **`Catalogue`** — the catalogue *frame* strings only (browse/enroll chrome). The catalogue's
  content-language join (course titles/missions) is **06's**, not here.
- **`Auth`** — sign-in / create-account / checkout (Paygate) chrome and error strings.
- **`Editions`** — the in-reader Edition switcher's *frame* strings (`Source`, `Translating`,
  `Failed`, `Add a language`). The content-language half is again **06's**.

Rules:

- **English (`en.json`) is the source of truth for keys.** A key exists iff it is in `en.json`; every
  other `messages/<code>.json` mirrors that key set exactly (enforced below).
- **Key names are semantic, not English-derived** (`Reader.nextLesson`, not `Reader.next_lesson_button`)
  — so re-wording English never renames a key.
- Rejected: flat dotted keys (loses `useTranslations` scoping) and per-component namespaces (brittle
  to renames/splits).

### Fork 2 (decided) — extraction approach → **bounded mechanical sweep**

One focused build pass extracts **all in-scope learner-surface strings at once** (the ~8 components
below), replacing hard-coded English with `t()` / `getTranslations` calls and populating `en.json`.
Rationale: the scope is already bounded (learner surfaces, 5 known langs), and *as-you-touch* would
leave chrome visibly half-English — the mixed state reads as a bug. `en.json` is authored in the
sweep; non-English files are LLM-drafted-offline-then-reviewed per ticket 04, decision 3.

- Ponytail guard: the sweep is **convention-driven, not speculative** — extract only strings that
  actually render on the in-scope surfaces. Do **not** pre-key admin/authoring/studio strings
  (out of scope per the map).

### Interpolation, counts & concatenation (documentation)

Absorbed into `next-intl`'s ICU format (pluralization resolved at 04 — do not re-litigate):

- **Variables** → ICU placeholders: `"Welcome, {name}"`, resolved `t('greeting', { name })`.
- **Counts** → ICU plural, one key: `"{count, plural, one {# lesson} other {# lessons}}"`. This is
  how progress labels ("N of M lessons") land — a single key, not string math.
- **Concatenation must be restructured into one key.** Concrete cases found in the sweep scope:
  - `CourseShell.tsx` — `<span>←</span> Courses` and `{l.seq}. {l.title…}`: the arrow/number stay as
    JSX/data; only the word "Courses" (→ `Reader.backToCourses`) is a key. Numbering is data, not a
    string.
  - Paygate — sentences like *"This reference is part of the full course"* become **one** key, never
    assembled from fragments, so translators get whole sentences with natural word order.

### Key-parity check (re-homed fog item — specced & closed here)

Per ticket 04's Downstream, catalogue staleness is now a **build-time key-parity check**, owned here.
Spec (ponytail — reuse the existing `vitest` runner, no new tooling):

- A test (e.g. `messages/parity.test.ts`) reads `en.json` and every other `messages/<code>.json`,
  flattens each to its **set of leaf key-paths**, and asserts each non-English set **equals**
  English's. It fails listing missing/extra keys per file.
- Runs in the normal `pnpm test` / CI gate — **CI fails on drift**. English is the reference set.
- **Not** a runtime `sourceHash` and **not** a Convex rail (04 rejected both). Pure static check.
- Optional nicety (not required): the same test can assert ICU placeholder-name parity per key, so a
  translator can't drop `{name}`. Ship the key-set check first; add this only if it earns its keep.

### Sized inventory (enough to size the build, not exhaustive)

In-scope learner surfaces and rough hard-coded-string counts (from a `Grep` sweep; noise-filtered):

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
`CourseShell.tsx:175-202` nest that ticket 01 flagged is inside the ~25 Reader strings.

**Escape hatch reminder (from 04):** Hindi/Devanagari chrome needs the app-shell font to mirror the
reader's `Noto_Serif_Devanagari` handling (`src/app/layout.tsx`) — the `Spectral` shell font has no
Devanagari glyphs. Not a string concern, but the sweep's acceptance QA must catch it.

### Downstream

- **Fog item "catalogue staleness / key-parity" → closed** (specced above). Remove from the map's
  "Not yet specified".
- Boundary held: 05 owns extraction + key convention + key-parity check. Storage/picker = 03;
  catalogue *content-language* join = 06.
