---
type: task
blocked_by: []
---
# The Teacher Q&A setting exists, and the owner can flip it

## Question

A course owner opens their Editions panel, lands on the source language tab, and finds a switch
labelled for **Teacher Q&A** sitting beside Publish and the public link. They flip it off. It stays
off across a reload, and it says plainly that it governs the whole course in every language rather
than just the Edition whose tab it sits on.

Nothing hides yet. This ticket lays the rail: the stored setting, the mutation that writes it, the
control that drives it, and the value arriving in the reader where tickets 02 and 03 will consume
it. Read [spec.md](../spec.md) first, particularly **Implementation Decisions**.

Two things it must get right, because everything downstream rests on them:

- **Absence means on.** The setting is an optional boolean on the **Topic**. A Topic that has never
  had it written must read exactly as one with it explicitly on. There is no migration, no backfill,
  and no default written onto existing rows. This is the whole reason the effort is cheap.
- **The reader needs the boolean itself, not an inference.** An empty question list is ambiguous: an
  owner who has simply never asked anything also has none, and that owner must still see the ask
  form. So the flag has to ride the course bundle the reader already loads. Deciding which existing
  query carries it is part of this ticket, and the answer belongs in the resolution.

The setting is **per Topic**, so it does not belong in the module that owns Edition-grained
publishing, nor in the per-tenant feature flag machinery, whose semantics are wrong here. It belongs
beside the Q&A behaviour it governs.

Leave the `qa` tenant feature flag completely alone.

## Done when

- An optional boolean lives on the Topic document, with a comment explaining that its absence means
  on and that it is distinct from the `qa` tenant feature flag.
- An owner-only mutation sets it, resolving the Topic through the same owner-only path publishing
  uses.
- A Viewer, an Editor, a Translator and a tenant Admin are each refused by that mutation, with tests.
- A Topic that has never had the field written reads as on, with a test. This is the single most
  important assertion in the effort.
- The toggle renders on the source language tab of the Editions dialog only, styled as the existing
  Publish and public link toggles are and reusing their row shape.
- Its label and hint say unambiguously that the setting applies to the whole course in every
  language, not to the Edition whose tab it sits on.
- Every string is keyed under the Editions namespace and present in all `messages/*.json`
  catalogues, following how the neighbouring toggles are keyed.
- Flipping the toggle updates reactively and survives a reload.
- The boolean reaches the reader on a course bundle query, and the resolution names which query
  carries it so tickets 02 and 03 can consume it without re-deciding.
- No change to `tenants.flags`, to the tenant flag helper, or to the admin portal.
- `pnpm typecheck` is green and the Convex suite passes.

## Answer

Built and committed on 2026-08-25 as `2928d46` (`feat(teacher-qa): add the per-Topic Teacher Q&A
setting and its owner toggle`). Verified by reading the code and by the Convex suite; **not walked
in a browser**, which is ticket 04's job.

**The setting.** `topics.teacherQa: v.optional(v.boolean())` in `convex/schema.ts`, commented with
the absence-means-on rule and with why it is distinct from the `qa` tenant flag. No migration, no
backfill, no default written onto any row.

**Absence means on lives in one function.** `teacherQaOn(topic)` in `convex/capture.ts` is the only
place `teacherQa !== false` is written; every consumer calls it rather than reading the field.
Tickets 02 and 03 should import it, not re-derive the rule. It is exported from `capture.ts`
alongside the mutation, following the prior art of `accessCodes.ts` (a module holding both
registered functions and plain helpers).

**The mutation.** `capture.setTeacherQa({ topicSlug, enabled })`, owner-only through
`requireOwnedTopic`, the same `getOwnedTopic` path `catalogue.setEditionPublished` uses. It writes
`true` explicitly rather than clearing the field, so the owner's decision is legible in the row and
still reads identically to absence.

**Which query carries the boolean, so 02 and 03 need not re-decide.** Two, one per reader path, and
both are bundles the reader already loads:

- **`content.reader.courseHeader`** for every authed caller (owner, Viewer, entitled, enrolled,
  preview). This is the one the desktop and mobile Q&A panels, the sidebar dots and the reply
  indicator should branch on. `CourseShell` already subscribes to it, so the panel gets the boolean
  with no new query.
- **`public.publicCourse`** for a Guest on a Public link. It has an explicit output allowlist, so
  the field had to be listed there deliberately; it now is.

Both return `teacherQa: v.boolean()` (never optional on the wire) resolved through `teacherQaOn`, so
a consumer never sees `undefined` and can never accidentally reintroduce the absence rule.

**The toggle.** `TeacherQaToggle` in `src/app/_components/Editions.tsx`, rendered as
`{edition.source && <TeacherQaToggle .../>}` beside `PublishToggle` and `PublicLinkToggle` and
reusing their row shape, so it appears on the source language tab only. It reads its value from
`courseHeader` (the same bundle the reader uses, so there is one source of truth) and writes through
`setTeacherQa`; both are live, so a flip is reactive and a reload re-reads the row. While the header
is loading it renders **on**, so a course with an open channel never flashes off. Icon is `chat`.

**Copy.** Four keys under `Editions`: `teacherQa`, `teacherQaOn`, `teacherQaOff`, and
`teacherQaWhole`. The last is a third line rendered in accent under the on/off hint, saying the
setting applies to the whole course in every language and not just this edition, because a
Topic-level control inside a per-language panel is otherwise misread. Present in all five
catalogues. **Provenance note:** a concurrent session's commit `8d38218` swallowed the
`messages/*.json` half of this work before `2928d46` landed, so the strings are committed there, not
in the feature commit. They are in the tree and the parity test passes.

**Tests** (`convex/capture.test.ts`, eight new cases): absence means on, asserted as an untouched
Topic and an explicitly-on Topic reading identically; the owner flipping off and on; per-Topic
isolation (one course off leaves a sibling on); owner-only refusal; a Viewer reading the setting off
the same bundle; the Guest bundle carrying it both ways; and stored Questions surviving the flip.

**One correction to this ticket's own Done-when.** It asks for a **Translator** to be refused, but
there is no Translator role in the tree: `shares.role` is `viewer | editor` only, and CONTEXT.md
records Translator as decided on 2026-08-11 and NOT built (`translator-status-report`). The test
covers a Viewer, an Editor, a tenant Admin (an `isAdmin` Allowlist row on the course's own tenant),
a stranger and a signed-out caller, and notes that a Translator, whenever built, will be a Share
holder failing on the same owner-only gate.

**Untouched, as required:** `tenants.flags`, `assertTenantFlag`, the admin portal, and
`askQuestion`'s tenant-flag gate. Nothing hides yet: the read gates are ticket 03 and the injected
CSS is ticket 02.

`pnpm typecheck` green; full suite 937 tests green (one `courseHeader` `toEqual` fixture in
`sharing-readonly.test.ts` updated for the new field, which is the cost of that assertion style).
