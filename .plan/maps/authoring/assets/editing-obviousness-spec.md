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
   [mobile-reader-todos ticket 03](../../mobile-reader-todos/tickets/03-rename-a-lesson.md).

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
- **D8: References rename source-only.** **Superseded 2026-08-31 by D9.**
  Matches their body edit
  (`editReference`), which is explicitly source-only today. Translated
  Reference editing as a whole stays out of scope.

## Decisions added 2026-08-31 (the operator asked for the rest of it)

The operator asked for "glossary and reference editing for other languages and
also lesson titles editing in the editor view preferably". That is one unit this
spec had ruled out (D8) and one unit whose shape it had settled differently (D5).

- **D9: a translated Edition's References are editable, by that Edition's
  Editor.** New `editTranslatedReference` mutation, the twin of
  `editTranslatedLesson` for References and of `editReference` for a non-source
  Edition: it upserts that Edition's `translations` row (kind `reference`),
  stamps `sourceHash` from the current source so a later re-translate keeps the
  correction, and leaves the source Reference and every other Edition untouched.
  A plain mutation, not an action, for the same reason `editReference` is one:
  References carry no quiz, so there is no structure to guard and no need to read
  either body's bytes. **Supersedes D8** and the map's out-of-scope line.
  Nothing about References had made this hard: the reader has always served a
  translated Reference (`loadEdition(...).reference`) and `publishTranslation`
  has always written the rows. Only the in-app write path was missing, and its
  absence is what left a translator able to fix every Lesson in their Edition but
  neither the grammar sheet nor the glossary.
- **D10: the rename affordance is a field in the editor view, not a title-side
  pencil. Supersedes D5.** The `ContentEditor` modal gains a Title field above
  the body editor, present wherever the editor itself is. Chosen on the
  operator's explicit preference, and it is also the lazier shape: one save
  writes body and name together through one already-guarded write path, there is
  one affordance to discover rather than two, and no new mutation, resolver or
  reader chrome is involved. The cost is that a rename now requires opening the
  editor, which is a fair trade while unit 1 (always-visible Edit) is still
  unbuilt and is the thing that makes the editor findable at all.
- **D11: the client writes the name to both places in one save.** It splices the
  display half of the document's `<title>` (`replaceTitleDisplay`, preserving the
  `Lesson N · ` / `Reference · ` prefix) and sends the same string as a `title`
  arg on the same call. The row's column is the authority (it is what the reader
  renders; nothing reads the blob's `<title>` at runtime), and the tag is what
  keeps a document self-describing when read on its own. Preferred over parsing
  the title back out server-side because two of the four write paths are plain
  mutations that never read the blob's bytes, and one contract across all four
  beats an asymmetry. D1's outcome (row and document never disagree) is
  preserved; only the computation moved to the client.

- **D12: the client aims an edit at the SERVED Edition, not the URL's
  `?lang`.** Found while building D9, and it is a bug the pre-existing Lesson
  path had too. `ArtifactView` keyed the write path off `useEditionLang()` (the
  URL), while the server computes `canEdit` against the Edition its resolver
  actually served (`courseHeader.lang`). Those diverge on the normal first visit
  of the very person per-Edition editing exists for: a Dutch Editor holds only
  `nl`, `nl` is not an app locale so the course-index redirect cannot pre-fill
  `?lang=nl` from the UI language, and nothing is in localStorage yet. She would
  land on a lang-less URL, be served and authorised on `nl`, and have the client
  send her save to the English source, where the upload guard refuses it and the
  editor shows a bare save failure. Fixed by deriving the target with
  `editionToEdit(header?.lang, urlLang)`, a pure function in `readerDerive.ts`
  (the house pattern for testable client logic, since there is no component-test
  rig), so client and server agree by construction.

## Shipped so far (2026-08-31)

- **Unit 4 (rename Lessons and References in place): shipped**, in D10's shape.
- **D9's translated-Reference editing: shipped** (not one of the original four
  units; it is what the operator's request added).
- **D12's edit-target fix: shipped**, and it repaired the existing Lesson path as
  well as the new Reference one.
- **Unit 1 (always-visible Edit buttons): shipped**, later the same day, when
  the operator asked for it in as many words. Both buttons lost
  `md:opacity-0 md:group-hover:opacity-100` plus the opacity plumbing that only
  existed to fight it (the base `opacity-100`, the two focus overrides,
  `transition-opacity`), and both wrappers lost the `group` class that existed
  only to drive it. `hover:bg-hi` stays, as an ordinary button hover state rather
  than the way the button is found. Visible at every breakpoint wherever
  `canEdit` holds, on Lessons and References alike.
- **Unit 2 (make the button unmissable): shipped**, same day. Accent styling
  (`bg-accent`, white label, `hover:bg-accent/90`) in place of the ghost card,
  and a real pencil from the icon set (`<Icon name="edit" />`, which existed and
  was used nowhere) in place of the "✎ " that had been living inside the
  translated string. The glyph came OUT of all five catalogues in the same
  change, so the button shows one pencil rather than two and each catalogue's
  `edit` is now just the word. **Correction to this file's own note from earlier
  the same day**, which said the pencil was already there and unit 2 was reduced
  to a restyle: true of what a reader saw, misleading about where the glyph
  lived, and acting on it as written would have shipped two pencils.
- **Unit 3 (Resources shown by default): shipped**, same day. Both `<details>`
  render `open`: the signed-in sidebar (`CourseShell`) and the Guest reader
  (`PublicReader`), the latter now for every caller rather than only a paid
  preview. Still collapsible per page load, still persisted nowhere.
- **Judgement call, recorded rather than asked:** `CourseShell`'s section
  renders even on a course with no Resources (it holds the "none yet" line and
  the owner's add controls), so on such a course it is now open and empty. Taken
  as this spec's literal intent rather than gated behind a non-empty list, since
  the add controls are exactly the sort of thing this effort exists to stop
  hiding. `PublicReader`'s section already sits inside a `resources.length > 0`
  guard, so a Guest never sees an empty one.

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
