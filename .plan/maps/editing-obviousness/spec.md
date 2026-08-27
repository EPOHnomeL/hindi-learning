# Editing obviousness: spec

Grilled and agreed 2026-08-27. Driver: the course author (an **Editor**, ADR
0020) reported being blocked on "editing the references" and "editing the
chapter titles". The facts behind the blockage, verified in the tree that day:

- Reference **body** editing already works for their role (owner or
  English-source Editor, source Edition only), but the pencil is
  hover-revealed on desktop (`md:opacity-0 md:group-hover:opacity-100`,
  `src/app/_components/ArtifactView.tsx`), so they never found it.
- **No title is editable anywhere**: `lessons.title` and `references.title`
  are schema columns populated at publish by parsing the blob's
  `<title>Lesson N · display</title>` / `<title>Reference · display</title>`
  (`titleFrom`, `convex/authoring.ts`), and no mutation touches them after
  that. "Chapter titles" is the author's word for Lesson titles.
- The sidebar Resources section defaults collapsed: a bare `<details>` in
  `CourseShell.tsx` (never open) and `open={preview}` in `PublicReader.tsx`
  (open for paid previews only).

## Units of work

1. **Always-visible Edit buttons.** Remove the desktop hover reveal from both
   the Lesson and the Reference edit buttons; the button is permanently
   visible at every breakpoint wherever `canEdit` holds.
2. **Make the button unmissable.** Pencil icon plus the localised "Edit"
   label, accent styling instead of the current ghost card. No banners, no
   onboarding hints, no first-visit tooltips.
3. **Resources shown by default.** Both `<details>` sections (signed-in
   sidebar, public reader for every caller, not just previews) render `open`
   by default. Still collapsible per page load; nothing persisted.
4. **Rename Lessons and References in place.** A small pencil beside the title
   wherever it renders, both breakpoints, turning the title into an inline
   text field. One pattern for both kinds. This unit also resolves
   [mobile-reader-todos ticket 03](../mobile-reader-todos/tickets/03-rename-a-lesson.md).

## Decisions (the grilling record)

- **D1: the name lives in both places, and rename keeps them agreeing.** A
  rename patches the row's `title` column AND splices the display part of the
  blob's `<title>` (preserving the `Lesson N ·` / `Reference ·` prefix),
  uploading a new blob and deleting the old, exactly as body edits do. Chosen
  over a column-only patch so document and row never disagree.
- **D2: gate = the body-edit gate.** Whoever may edit an item's body may
  rename it: owner or that Edition's Editor for Lessons; owner or
  English-source Editor, source Edition only, for References. Renaming is
  strictly weaker than rewriting the body, so gating it tighter would be
  incoherent (and would fail to unblock the Editor who asked).
- **D3: a source rename leaves translated Editions alone.** Matches the
  existing `editLesson` precedent for bodies. Each ready Edition owns its
  title rendering; no staleness flag, no overwrite.
- **D4: rename works on translated Editions too, symmetrically with body
  edits.** On the source it goes via the lessons row and blob; on a translated
  Edition it patches that Edition's `translations` row `title` (an existing
  optional field) and that row's blob `<title>`. Mirrors
  `editLesson`/`editTranslatedLesson`. References stay source-only (D2).
- **D5: the affordance is a title-side pencil, not the lesson-bar button.**
  Ticket 03's earlier prototype (Rename button in the mobile lesson bar's
  freed slot) is superseded: one affordance, sitting on the title itself, both
  breakpoints, shared by Lessons and References.
- **D6: one text field edits the whole stored display string.** Titles are
  stored as "Head" + em dash (U+2014) + "subtitle" and chrome shows the head;
  the rename field exposes and saves the full string as one value. (Routine
  call, recorded here.)
- **D7: no quiz guard on rename.** The splice touches only the head
  `<title>`; it cannot reach the body, so `quizStructureMatches` is not
  involved. The blob-swap safety rules from `editLesson` still apply: never
  swap onto an unreadable upload, delete the new blob if the apply fails.
- **D8: References rename source-only.** Matches their body edit
  (`editReference`), which is explicitly source-only today. Translated
  Reference editing as a whole stays out of scope.

## Ripple checks for the build session

- Sidebar list, drawer, and the Home Continue card all read the title through
  reactive Convex queries; a rename propagates with no extra work. Verify by
  eye anyway.
- Certificates snapshot the course title and lesson count, never lesson
  titles: no impact.
- New i18n strings (rename affordance labels, refusal messages) go to all
  five locales, following the existing `Artifact` namespace pattern.
- Refusals must be thrown as `ConvexError` so the message survives prod
  redaction (see `saveError`, `ArtifactView.tsx`).

## Out of scope

See [map.md](map.md). Additionally: no change to publish-side title parsing
(`titleFrom` stays the source of a *new* item's title), and no renumbering of
`seq` (the sidebar's "N." prefix is derived, not part of the title).
