# Spec: Teacher Q&A, a per-Topic show/hide for the question channel

<!-- Written 2026-08-25 from a /grill-with-docs session. The term is recorded in
     CONTEXT.md ("Teacher Q&A"); no ADR was raised (the setting is an optional boolean
     whose absence means ON, so it is cheap to reverse). This spec is the build
     contract. Where it disagrees with CONTEXT.md, the glossary wins on *meaning* and
     this file wins on *scope*. -->

## Problem Statement

Some courses should not offer a question channel at all. YWAM Potchefstroom's prophetic school is
the motivating case: a discipleship course where the "teacher" answering questions is a language
model, and the school does not want learners forming that relationship with it.

Today the platform has no way to express that, and the one control that looks like it does is a
trap. A `qa` **[[Feature flag]]** already exists per **[[Tenant]]**, exposed in the admin portal as
*"Questions: Learners can ask questions on a lesson"*. It gates exactly one thing: the
`askQuestion` mutation, server side, at the API boundary. It hides **nothing**. Turn it off and the
learner still sees the Q&A panel, still sees the ask form, still types a question, presses Ask, and
receives the error *"This feature isn't available on this site."* That is worse than either
extreme.

There are two visible surfaces, and both have to go together:

1. **The Q&A panel.** A persistent right hand column on desktop and an inline block at the foot of
   the lesson on mobile: the ask form, the owner's **[[Question]]s** and **[[Reply|Replies]]**, and
   a matching read only panel for a **[[Viewer]]** and a **[[Guest]]**. A sidebar dot flags lessons
   carrying a Reply the learner has not seen.
2. **The green "ask your teacher" block.** A `.ask` div at the foot of every **[[Lesson]]**, part of
   the authoring contract's standard structure, rendered from the lesson's own immutable HTML. Its
   text is an explicit invitation: *"I am your teacher, ask me anything... just ask me in the
   chat."* Leaving it while removing the panel ships an invitation with no way to accept it.

The second surface is the awkward one, because Lessons are **immutable** once published and the
block lives inside their stored HTML. The obvious reading is that hiding it requires rewriting
every published lesson across every **[[Edition]]**.

## Solution

One owner controlled setting per **[[Topic]]**, named **Teacher Q&A**, that shows or hides both
surfaces as a single unit.

Three findings from the grilling collapse most of the expected work:

**No HTML rewrite is needed.** Every lesson iframe on every reader path (owner reader, public
reader, paid preview) is built by one function, `buildSrcDoc` in the `lessonSrcDoc` module, which
already injects conditional CSS for Devanagari, tenant palettes and lesson justification. Adding
`.ask{display:none}` there hides the green block everywhere at once, leaves the stored HTML
untouched and immutable, and makes the setting instantly reversible: switch it back on and the
block returns on every lesson, including ones authored while it was off.

**No attribution is lost.** The green block in the prophetic school's lessons carries a "Main source
for this week's reading" citation as well as the invitation, which looked like a blocker. It is
redundant: the `<footer>` immediately below every one of those lessons carries the fuller
attribution already (author, book, publisher, chapter, page numbers, quoted lines), and the
authoring contract mandates that footer `Sources` line while never asking for a citation inside
`.ask`.

**No backfill is needed.** The setting is an optional boolean whose **absence means on**, which is
exactly today's behaviour. Nothing regresses for any existing course on any tenant at deploy time.

The setting gates the **read** path, which is the one place it deliberately departs from an
established pattern. `assertTenantFlag` is documented as never touching read paths, because a
**[[Feature flag]]** is *frozen, not revoked*: turning one off blocks new grants and never destroys
what exists. Teacher Q&A is not that. Its whole job is to stop learners seeing a channel that
already has content in it, so the server withholds the Q&A rather than the client merely declining
to draw it. This also closes a wire leak: a Guest on a **[[Public link]]** receives the owner's Q&A
in the course bundle, and a client side hide would leave it readable in devtools.

The two mechanisms therefore coexist on purpose and are not unified: the tenant `qa` flag refuses
the *asking*, Teacher Q&A decides the *showing*.

## User Stories

1. As a course owner, I want a single switch that removes the question channel from my course, so that learners are never invited into a conversation I do not want them having.
2. As a course owner, I want that switch to hide the green "ask your teacher" block as well as the Q&A panel, so that my course never shows an invitation it cannot honour.
3. As a course owner, I want the switch to live beside Publish in the Editions panel, so that I find it where I already manage how my course is offered.
4. As a course owner, I want to set it once on the source language tab rather than per language, so that turning it off is one click and not one click per Edition.
5. As a course owner of a six language course, I want the setting to apply to every Edition automatically, so that a newly translated Edition cannot silently reintroduce the channel.
6. As a course owner, I want the setting to default to on, so that nothing about my existing course changes when this ships.
7. As a course owner, I want to turn it back on and see the green block reappear on every lesson including old ones, so that the decision is never one way.
8. As a course owner, I want the toggle to reflect its current state immediately and reactively, so that I am never unsure whether it took effect.
9. As a course owner with Teacher Q&A off, I want my own reader view to match what learners see, so that I can verify the course looks right without impersonating a learner.
10. As a course owner with Teacher Q&A off, I want the green block hidden in the in place lesson editor too, so that what I edit matches what is published.
11. As a course owner, I want questions already asked to be preserved rather than deleted when I turn the setting off, so that turning it back on restores the conversation intact.
12. As the only person who may change it, I want Teacher Q&A to be owner only, so that neither an Editor nor a tenant Admin can change how my course teaches.
13. As a learner on a course with Teacher Q&A off, I want no Q&A panel on desktop, so that the lesson uses the full reading width.
14. As a learner on a phone, I want no inline Q&A block under the lesson, so that the lesson ends at its footer.
15. As a learner, I want no green "ask your teacher" block at the foot of the lesson, so that I am not invited to message a teacher who will not answer.
16. As a learner, I want no unread reply dot in the lesson sidebar, so that nothing hints at a conversation that is not there.
17. As a learner, I want no "New reply from your teacher" indicator anywhere, so that the course does not signal activity it does not have.
18. As a learner on a course with Teacher Q&A **on**, I want everything to behave exactly as it does today, so that this change is invisible to me.
19. As a **[[Viewer]]** of a shared Edition with Teacher Q&A off, I want no read only Questions and Replies panel, so that I see the same course the owner intends.
20. As a **[[Guest]]** holding a **[[Public link]]** to a course with Teacher Q&A off, I want the owner's Q&A absent from the page, so that the course reads as the owner published it.
21. As a **[[Guest]]**, I want the owner's Q&A absent from the network payload and not merely hidden in the DOM, so that it is genuinely withheld rather than cosmetically removed.
22. As a buyer looking at a paid **[[Preview]]** of a course with Teacher Q&A off, I want no Q&A surfaces, so that the preview represents the course accurately.
23. As a tenant Admin, I want the existing `qa` feature flag to keep working exactly as it does, so that nothing I configured for my site changes underneath me.
24. As a developer reading the code later, I want it obvious why two Q&A gates exist, so that I do not unify them and break one of them.
25. As a developer, I want the setting to require no migration or backfill, so that deploying it is not an operational event.
26. As a developer, I want the green block hidden by injected CSS rather than by rewriting stored HTML, so that Lesson immutability is never violated.
27. As the teach **[[Routine]]**, I want to keep authoring the `.ask` block unconditionally, so that a course whose owner later turns Teacher Q&A on has the block present on every lesson.
28. As a course owner who turns the setting off, I want no further questions to reach my review queue, so that the queue reflects a channel that is actually open.
29. As a learner, I want a course with Teacher Q&A off to still show its quizzes, `.win` blocks, recaps and footers, so that only the question channel is removed and not other teaching furniture.
30. As a learner, I want the lesson's source citations in the footer to survive, so that attribution to the underlying course material is never lost.

## Implementation Decisions

**Grain: per Topic, not per Edition and not per Tenant.** Everything currently at Edition grain
(publishing, price, public link, translator grants) has a reason to differ by language. Whether a
course offers a question channel does not: it is a pedagogy choice about the course. Per Edition
would also have meant one toggle per language tab. Per Tenant already exists as the `qa` flag and is
too coarse, since a school may want one course silent and another conversational.

**Storage: one optional boolean on the `topics` document.** No new table, no new index, no join on
the read path. The `topics` document already carries many optional scalars of this kind.

**Absence means on.** This is the whole migration story. An unset field reads as the current
behaviour, so no existing course changes and no backfill mutation is written. This deliberately
inverts the request's original "default to off", which was reconsidered during grilling: defaulting
off would have silently darkened every course on every tenant at deploy, including courses the
operator does not own, to save a single click on the one course that wants it.

**One setting, both surfaces.** Not two booleans. The four state space of two independent toggles
contains two incoherent states (an invitation with no ask box, an ask box with no invitation), and
neither has a use case.

**The green block is hidden by injected CSS at render, never by rewriting stored HTML.** The
`lessonSrcDoc` module gains an option on both `buildSrcDoc` (the reader) and `buildEditDoc` (the
owner's in place editor) that injects a rule hiding `.ask`. Both builders receive it, so the editor
is WYSIWYG against the reader. Lessons stay immutable and the setting stays instantly reversible.

**The setting gates the read path, server side.** `capture.myQuestions` returns an empty list when
the Topic has Teacher Q&A off, and the guest course bundle in the `public` module returns an empty
`questions` array. This is a deliberate departure from `assertTenantFlag`'s documented rule that
flags never gate reads, and the reason is recorded in the glossary term and should be recorded in a
code comment at both sites.

**One query change silences three surfaces.** The Q&A panel and the sidebar unread reply dots read
the *same* query, `capture.myQuestions`. Emptying it removes the panel's content, the dots and the
"New reply from your teacher" indicator together, with no separate suppression logic.

**The reader still needs the flag itself, not just an empty list.** An empty `myQuestions` is
ambiguous: an owner who has simply never asked anything also gets an empty list, and that owner must
still see the ask form. The boolean therefore has to reach the reader on the course bundle the
reader already loads, and the components branch on the boolean rather than on list emptiness. Naming
the exact carrying query is the first implementation ticket's job.

**Module homes.** The new owner only mutation and the read gate both belong in the `capture` module,
which already owns `askQuestion`, `myQuestions` and `replyToQuestion`. Putting the setting beside
the behaviour it governs keeps one concept in one file. It does **not** go in `catalogue` (that
module is Edition grained) nor in `tenantFlags` (wrong grain and wrong semantics).

**Permission: owner only.** The mutation resolves the Topic through the same owner only path that
`setEditionPublished` uses. Explicitly not an Editor, not a Translator, not a tenant Admin, matching
every other control in the Editions dialog.

**The tenant `qa` flag is untouched.** No schema change to `tenants.flags`, no change to the admin
portal, no change to `assertTenantFlag`. It keeps refusing `askQuestion` at the API boundary. The
two gates are independent and are documented as such.

**The authoring contract is untouched.** The teach skill keeps mandating `.ask` in every lesson.
Making authoring conditional would require plumbing the flag into workspace materialisation and the
prompt, and would permanently leave every lesson written while the setting was off without an ask
block, since Lessons are immutable. The cost of not doing it is a few hundred wasted output tokens
per lesson.

**UI placement.** A toggle in the Editions dialog, on the source language tab only, styled as the
existing Publish and Public link toggles are and reusing their row shape. It is a Topic level
control sitting in an Edition level panel, so its copy must say so plainly (it applies to the whole
course, every language).

## Testing Decisions

A good test here asserts **external behaviour**: what a given caller can see. It does not assert
that a particular CSS string was concatenated, that a component rendered a particular class name, or
that an internal helper was called. The seams below were chosen so that each test names a caller and
an outcome.

**`lessonSrcDoc` is the highest seam and already has tests.** `buildSrcDoc` is a pure function from
HTML plus options to HTML, with an existing `lessonSrcDoc.test.ts` covering theme baking, direction,
Devanagari and bridge injection. Prior art is directly reusable. Tests: with the option off the
output contains no rule hiding `.ask`; with it on the output hides `.ask`; the lesson body itself is
byte for byte unchanged in both cases (the immutability guarantee); `buildEditDoc` behaves the same
way.

**The Convex read gate is tested with `convex-test`.** Prior art is plentiful and close:
`public.test.ts` covers the guest bundle's shape, `edition-reader.test.ts` covers per Edition
reading, and `tenantFlags.test.ts` covers a gate that allows and denies. Tests: an owner with the
setting on sees their questions; the same owner with it off receives an empty list; a Viewer of a
shared Edition receives an empty list when it is off; the guest bundle omits questions when it is
off; a Topic that has never had the field set behaves exactly as one with it explicitly on (the
absence means on guarantee, which is the single most important assertion in this spec).

**The mutation's authorisation is tested.** The owner may set it; a Viewer, an Editor and a tenant
Admin may not. Prior art: the owner only tests around `setEditionPublished` and the share role tests
in `sharing-readonly.test.ts`.

**Deliberately not tested at the component level.** Whether React renders the panel is left to the
boolean that reaches it, which is covered at the query seam. Adding component tests for
conditional rendering would be testing the framework.

`pnpm typecheck` is the cheap whole repo verification and needs no dev server. Do not start or stop
one.

## Out of Scope

- **Per Edition Q&A visibility.** Considered and rejected during grilling. If a real need appears
  for "Q&A in English but not in Sesotho", it is a separate change.
- **Hiding Q&A from Guests only while keeping it for signed in readers.** This is the older deferred
  idea recorded in the **[[Guest]]** glossary term. Teacher Q&A is all or nothing per Topic and does
  not deliver the Guest only variant, which stays unbuilt. The glossary was corrected on 2026-08-25
  to say so.
- **Retiring or renaming the `qa` tenant feature flag**, and any change to the admin portal.
- **Fixing the poor experience of the `qa` flag being off** (a visible ask form that errors on
  submit). Turning Teacher Q&A off is the recommended way to silence a course; making the tenant
  flag hide its own surfaces is a separate decision.
- **Deleting existing Questions and Replies.** The setting hides, it never destroys.
- **Making the teach Routine skip authoring `.ask`.**
- **Any migration, backfill or data rewrite.** There is none, by design.
- **An ADR.** Considered against the three bars and skipped: the setting is an optional boolean
  whose absence means on, so it fails the hard to reverse bar.
- **Removing the citation habit from the prophetic school's `.ask` blocks**, or any other content
  edit to existing lessons.

## Further Notes

**Verify before reasoning from this file.** Two claims here were themselves stale beliefs corrected
during the grilling, and the same can happen to this spec. Specifically: the `qa` tenant flag was
believed to be a full feature gate and is only a write gate; the green block was believed to carry
unique attribution and does not.

**The motivating tenant is `ywampotch`, the course is `prophetic-school`.** Its nine lessons all
carry a `.ask` block of identical two part shape (invitation, then a "Main source for this week's
reading" citation) and a `<footer>` carrying the fuller attribution. That course is the acceptance
case: with Teacher Q&A off, a learner reading it should see no panel, no dots, no green block, and
an intact footer citation.

**The `.ask` class is styled in the lesson design system's head partial** as a green gradient
surface, with a dark theme variant. Hiding is done by a display rule, so neither theme needs
special handling.

**Copy needs care.** The toggle sits inside a per language panel but governs the whole course. Its
label and hint must make that unambiguous, and the strings need entries in every `messages/*.json`
catalogue, following how the Publish and Public link toggle strings are keyed under `Editions`.

**Next step is `/to-tickets`**, which should produce roughly: (1) the schema field, the owner only
mutation and the read gates, with the carrying query named; (2) the `lessonSrcDoc` option and its
tests; (3) the Editions toggle and its i18n strings; (4) a walk of `prophetic-school` in a browser
with the setting off, since "verified by reading the code" and "walked in a browser" are different
claims and this feature is entirely about what a person sees.
