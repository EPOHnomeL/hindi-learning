# Mobile bottom nav: the prototype record and its verdict

**Status: resolved, D shipped (2026-08-23).** This is the archived record of the
mobile bottom-nav prototype. The prototype code (`MobileNavPrototype.tsx`,
`AppTabsPrototype.tsx`, the `proto` gates) is deleted; variant D is production
code (`AppTabs.tsx`, `SettingsPage.tsx`, `LessonFoot.tsx`,
`CourseCardActions.tsx`). Sections below describing how to run the prototype are
history, kept because they carry the decisions and every rejected alternative.
See `## Verdict` at the bottom for what shipped and what it cost.

## Question

The mobile experience of the reader is weak (see
`.plan/maps/ui-overhaul/assets/surface-inventory.md`). Today the only mobile
navigation is a 48px top bar whose course title toggles a bottom drawer holding
the entire desktop sidebar. **If navigation moves to a bottom bar, what should
that bar actually be?**

That is the real fork. "Bottom nav" is not one design; it is at least three
different bets about what a learner does on a phone.

## How to run it

```
pnpm dev        # and, in another terminal, pnpm dev:backend
```

Open any lesson on a narrow viewport (or device toolbar) and add `?variant=`:

```
/courses/<slug>/lessons/<key>?variant=A     course chrome
/courses/<slug>/lessons/<key>?variant=B     course chrome
/courses/<slug>/lessons/<key>?variant=C     course chrome
/?variant=D                                 app chrome (works on any route)
```

**D is a different kind of answer** and was added after the first round: A, B
and C replace the reader chrome and only exist inside a course, whereas D is
app-level and lives in the root layout, so it is present on Home, in the reader
and on the admin portal alike. Under D the reader keeps its existing top bar and
lesson drawer. The chosen variant latches for the browser session, so the D bar
survives walking Home to lesson to Settings.

A magenta pill at the top centre cycles the variants; left/right arrow keys do
the same. It sits at the top on purpose, since the bottom is the thing being
judged. It never renders in a production build, and with no `?variant=` the
shell behaves exactly as it does today.

Desktop is untouched by all three: every variant is `md:hidden`, and the real
sidebar only hides below `md` while a variant is engaged.

## The three bets

| | Bet | Bottom bar is | Cost |
|---|---|---|---|
| **A. Tab bar** | Sections are peers; the app should feel like a native tabbed app | 4 icon tabs (Lessons, Reference, Files, More), each opening its own sheet | Course title and back-to-library get demoted into "More"; 64px of permanent chrome |
| **B. Reader rail** | People mostly read *forward*; browsing is rare | Prev / progress pill / Next. The pill opens a horizontal chip scrubber | Reference and Resources are two taps deep behind a segment; a top-right menu creeps back in |
| **C. Course map** | Seeing the shape of the course beats one-tap section jumps | An always-on dock (current lesson + progress) that expands in place into a 4-column numbered grid | One surface does everything, so the expanded state is long; the grid gets thin past ~24 lessons |
| **D. App tabs** | The bar belongs to the *app*, not the course: Home, Continue, Settings, Admin | 3 or 4 app tabs, plus a resume card above the bar on Home | The lesson list keeps the old top-bar drawer, so in-course navigation is unchanged and still the weakest part |

## What to look at while flipping

- Does the reading area still feel big enough with permanent bottom chrome?
  (A costs the most, C the least when collapsed.)
- Reaching the *next* lesson: A is 2 taps, B is 1, C is 2.
- The locked/paywalled state renders in all three. Does the lock read on a
  small tile (C) as well as on a row (A)?
- Progress: A hides it in a header line, B and C keep it on the bar.
- The lesson body is a sandboxed iframe. Does anything here fight its scroll?

## Known prototype shortcuts

- English strings, no `next-intl`. Real work must go through `Reader`/`Common`.
- Course settings and the Edition/language switcher are rendered as **dead**
  rows. They are real dialogs in the shell; wiring them is not the question.
- No swipe gestures, no drag-to-expand on C (tap only).
- Continue remembers the last lesson in `localStorage`, not on the server. The
  real thing needs a "most recent progress row across all my topics" read, which
  the `progress` table cannot answer today: it is indexed `by_topic_user_lesson`,
  with no by-user index and no `lastReadAt`. That is D's one backend cost.
- Only the authed reader (`CourseShell`) is prototyped. `PublicReader` is a
  near line-for-line fork of it, and whatever wins has to land in both, which is
  itself an argument for ticket 06 (collapse duplication) landing first.

## Round 1 feedback (2026-08-23)

Asked for A, B and C, the answer was **none of them, as framed**: the bar wanted
is Home (where the courses are), a place to pick up where you left off,
Settings, and an Admin tab for an admin. That is app navigation, not course
navigation, which is why **D** exists.

### Naming the resume tab

**Settled on "Course"** (2026-08-23, second pass), with a **document** glyph: a
page with a folded corner and two text lines. Three glyphs were rejected getting
there, and the pattern in the rejections is worth keeping: the icon set's `book`,
a bookmark and a mortarboard all tried to say *what kind of thing a course is*,
and a page just says what you are about to look at. Two interior lines, not three:
three go to grey mush at 20px. The reason for the *word* is the bar, not the word
itself: Home, Settings and Admin are all
*places*, so a verb in slot two read as the odd one out. The tab still resumes,
and "pick up where you left off" is spelled out on the Home resume card, which has
the room for a sentence that a 10px tab label does not.

The first pass shipped **Continue**, on the grounds that it is the one word a
non-technical learner reads as "put me back where I was" with no instruction.
That is still true in isolation; it just lost to consistency across the bar. Its
runners-up, kept because they are the same shortlist any rethink will land on:

- **Resume** reads as a document or a job application first.
- **Keep going** is warmer but two words, and it wraps at a 10px tab label.
- **Learn** (the Duolingo convention) names an activity rather than a place, so
  it stops being honest when the tab lands you mid-Reference.
- **Current** / **Reading** are noun-shaped like the other tabs, but neither
  says the tap moves you.

- **Course** won: a noun like its neighbours, and unambiguous once you are in one.
  Its weakness is the empty state, where "Course" does not say *which*; the muted
  tab carries that.

## Decided on D (2026-08-23)

- **The back arrow in the reader header is now a hamburger.** Under D the Home
  tab owns "back to the library", so the arrow was redundant. Tapping either the
  hamburger or the course title opens the lesson drawer.
- **Lesson navigation: keep the drawer, add an end-of-lesson Next card.** Chosen
  over an always-visible chip strip, a grid in the drawer, and a contextual row
  above the tab bar. It is the cheapest of the four and it makes the drawer rare
  rather than central.

- **Course settings and the reading-language switcher are off the lesson drawer.**
  Settings already existed on Home (the owned card's pencil), so the drawer was a
  second door to the same dialog. Under D the drawer is lessons, references and
  resources, nothing else.
- **The app language is now an obvious control on Home**, in the header beside the
  gear. `LocalePicker` already existed but was only mounted in the site footer,
  which on a phone sits below every course in the library.
- **The owner's card controls collapsed into one three-dots menu** (Course
  settings, Editions and sharing). The card was carrying up to five tap targets in
  one row on a phone: Open, a pencil, a globe, a certificate menu and an admin
  menu.
- **Advancing marks the lesson complete, and says so.** The Next card reads
  "Complete and continue" until the lesson is done, then plain "Next". Rejected
  the silent version: Progress gates certificate eligibility and feeds the
  authoring Routine, so ticking lessons a reader only tapped past would read as a
  bug the first time they noticed. One tap, two effects, both named.
- **The "Mark complete" FAB is retired wherever the card can do its job**, i.e.
  any lesson with a next lesson. It survives on the last lesson (and the
  Frontier), which also settles the collision noted below rather than dodging it.

- **The owned course card is one row of three targets:** `[ Open course ]
  [ globe ] [ kebab ]`. It had grown to five, including **two visually identical
  kebabs side by side** (the certificate menu and the admin menu), which is
  unreadable. The kebab now holds the certificate, Course settings, Editions and
  sharing, and the admin "Finish generating course" / "Cancel generation", with a
  dot when any of them wants attention. `CertificateControl` is reused rather than
  reimplemented, so no claim mutation is duplicated.
- **Settings is a route, not a sheet.** `/settings` in the (app) group, scrolling
  in normal document flow: no close button, no scrim, no overlay. The URL is
  linkable, browser back works, and the Settings tab is a destination like Home.
  The app-language control lives there and only there.

- **The Home header keeps only the brand on a phone.** The gear, the Admin link
  and Sign out all left it: Admin is a tab in the bar, and the account controls
  belong on the Settings page. Sign out is wired for real there, since placement
  is the one thing about it you cannot judge without doing it.

- **The certificate pill is off the lesson bar** (Home already has it), and the
  freed slot became a **Rename** button for the lesson title, with an inline field
  over the title itself.
- **The display name is live on the Settings page**, against the same
  `api.users.setName` the old dialog used. It had to be: it is the setting that
  lost its only mobile door when the Home gear came off.

### Two languages, one word

Worth keeping straight, because the two controls were both labelled "Language":

- The **app language** (chrome locale, `LocalePicker`, `messages/*.json`) is an
  account-level preference. It belongs on Home. Now there.
- The **reading language** (the Edition of *this* course, `?lang=`) is per-course
  and cannot sensibly live on Home, which lists many courses. It is now the globe
  button on the course card, listing English plus each ready Edition, and only
  appears once a translation exists: one Edition is not a choice. The shared and
  purchased cards already carried theirs as chips, so only the owner card needed
  it.

Two things that surfaced while building it, both real bugs in the app today
rather than prototype artefacts:

- **An owner has no forward navigation on a phone.** The only next-lesson link
  is a small button in the reader top bar, gated on `readOnly`, so it exists for
  a shared Viewer and not for the person who owns the course. Most of why the
  drawer felt load-bearing.
- **The "Mark complete" FAB sits exactly where a bottom bar goes** (`bottom-6
  right-6`). Any bottom nav collides with it. Lifted to `bottom-[6.25rem]` under
  D; whichever variant wins has to answer for that button. Note it is also
  `hidden md:inline-flex` in the top bar, so the FAB is the *only* way to mark a
  lesson complete on mobile.

## The rename does not save, on purpose

The Rename field edits local state and says **Not saved** on screen rather than
pretending. It cannot save yet, and the reason is structural: a lesson has **no
title field**. The name is parsed out of the lesson document's
`<title>Lesson N . <display></title>`, and the in-place content editor applies
`replaceBodyInner`, which swaps the body only, so no existing edit path can reach
it. `renameTopic` exists for a course; there is no lesson equivalent. Ticketed as
[rename a lesson](../../mobile-reader-todos/tickets/03-rename-a-lesson.md),
where the real decision is whether the name becomes a column or stays in the
document, and what a source rename does to translated Editions.

## Watch this one on the way out

Removing the Home gear makes `SettingsDialog` **unreachable on mobile under D**,
and it holds one setting with no other door: the **display name printed on
certificates**. The prototype page carries a dead `Display name` row to mark the
spot. If D wins, folding `SettingsDialog` into `/settings` is part of the work, not
an afterthought, or that setting is simply lost on a phone.

## Still open on D

1. **Is Continue a jump or a place?** Right now it is a jump: one tap and you
   are in the lesson you left. The alternative reading of "a continue place" is
   a screen that lists what is in flight across several courses, then you pick.
   The jump is better with one active course, the list wins with three.
2. **What happens to the lesson list?** D leaves it in the old top-bar drawer,
   which was the original complaint. It probably needs one of A or C grafted in
   *underneath* D, which would make the real answer "D plus C", not a single
   winner.
3. **Settings is a full-screen page** here, over the top of the tab bar. It
   could instead be a real `/settings` route (a back button and a URL, so it is
   linkable and survives reload). Rows are dead on purpose except the theme
   toggle.
4. **Admin as a peer tab.** It sits beside Home for a sys or tenant admin, which
   spends a quarter of the bar on a surface only a handful of people ever open.
   A row inside Settings is the cheaper alternative.

## Verdict

**D wins, confirmed by the user 2026-08-23.** A, B and C lost as framed (round 1
above): the bar wanted is app navigation, not course navigation. Nothing from
the losers was grafted in yet; open question 2 above (whether the lesson list
eventually needs A or C underneath D) stays open and belongs to the
[ui-overhaul map](../map.md)'s Mobile-readiness bar patch.

Shipped as production code on 2026-08-23:

- **The bar**: `src/app/_components/AppTabs.tsx`, mounted in the root layout.
  Continue is server-side now: `progress.lastReadAt` plus a `by_user_lastReadAt`
  index and `capture.myLastRead` (the one schema change D carried), so the
  resume point survives devices.
- **`/settings`** is a real page (`SettingsPage.tsx`): display name (the
  certificate name, wired to `api.users.setName`), signed-in-as, app language,
  theme, the three legal links, sign out. `SettingsDialog` survives for the
  desktop gear, which the phone header no longer shows.
- **The end-of-lesson card** (`LessonFoot.tsx`) landed in BOTH readers,
  `ArtifactView` and `PublicReader`, deliberately twice: ui-overhaul ticket 06
  still owns the collapse decision, and waiting on it would have shipped the
  guest reader without forward navigation parity.
- **The FAB** survives only on the last lesson and the Frontier, lifted above
  the bar, and reads "Finish course" on a completed course's last lesson
  (resolves mobile-reader-todos 02). Everywhere else the card absorbed it.
- **The owner card row** (`CourseCardActions.tsx`): Open, globe, one kebab. The
  certificate pill is off the lesson bar (resolves mobile-reader-todos 01).
- **The lesson Rename button did NOT ship.** It cannot save until
  [mobile-reader-todos 03](../../mobile-reader-todos/tickets/03-rename-a-lesson.md)
  decides where a lesson's name lives, and a Save button that does not save is
  worse than an empty slot. The settled UI (a Rename button in the freed
  certificate slot, an inline field over the title) is recorded above; rebuild
  it from this file when 03 lands.

Known costs, accepted knowingly rather than discovered later:

- An **Editor of a translated Edition** lost the reader-drawer door to Course
  settings (Details, edition-title-edit 02). They own no Home card, so their
  only remaining edit surface is the in-place content editor. Ticketed as
  [mobile-reader-todos 05](../../mobile-reader-todos/tickets/05-editor-details-door.md).
- A **Viewer holding several Editions** has no in-reader switcher any more;
  `?lang=` in the URL still works, and owners switch via the card globe.
  Ticketed as
  [mobile-reader-todos 06](../../mobile-reader-todos/tickets/06-viewer-edition-switcher.md).
