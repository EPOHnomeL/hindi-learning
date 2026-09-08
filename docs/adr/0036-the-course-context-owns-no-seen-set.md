---
status: accepted
supersedes: 0012 (in part)
---

# The course-scoped context owns no seen set, because the notification dots were never built

Decided 2026-09-08 while resolving part of
`.plan/maps/technical-foundation/tickets/33-one-reader-course-module.md`.

**This is a narrow superseding note and nothing more.** ADR 0012's actual subject,
URL-addressable navigation via the App Router, is untouched and still stands: the
course sidebar is a `layout.tsx` that stays mounted across lesson navigation, the
artifact pane is the `page`, data stays on live client `useQuery` subscriptions,
and `/courses/[slug]` still redirects so the URL always names what is on screen.
None of that is reopened here.

## What ADR 0012 said

Two passages gave the course-scoped context a specific job:

> A small **course-scoped context provider** in that layout owns the
> cross-cutting `seen` set (notification dots read it; the lesson page calls
> `markSeen` on open) and fetches the per-course queries once.

and, in its consequences:

> `Reader` is split into the course layout + lesson page; its `seen`/notification
> logic moves into the course-scoped context.

So the seen set was named as the reason the context exists at all.

## What was actually in the tree, verified 2026-09-08

**The notification dots do not exist, and never did.** Traced end to end:

- `CourseShell.tsx` loaded a `Set<string>` of answered-question ids from
  `localStorage` under `hindi:answers-seen`, exposed `markSeen` on the context,
  and persisted a new set on every lesson open.
- `CoursePanes.tsx`'s `LessonPane` called `markSeen(lessonKey)` in an effect.
- `readerDerive.ts` carried `seenAfterOpening` to compose the new set and
  `unseenReplyKeys` to answer which lessons had an unseen reply.
- `NavItem.tsx` declared a `notify?: boolean` prop and rendered a dot for it.

And nothing joined the two halves. `unseenReplyKeys` had **three passing tests and
zero production callers**. `NavItem`'s `notify` was **never passed by either
reader**. The set was written, persisted and swept on sign-out for a renderer that
was never wired up. The only thing that ever read `hindi:answers-seen` was the
sign-out sweep's own test.

## The decision

**The course-scoped context owns no seen set.** All of the machinery above is
deleted rather than kept warm for a dot that has had no caller since the split.

Two consequences worth naming:

- **The context is smaller by one member and the shell by one subscription.**
  `myQuestions` was subscribed in `CourseShell` for the seen set alone, so
  deleting the dead half removed a live subscription from the course layout as
  well. The question box subscribes it where it is rendered.
- **`localStorage` keeps a `hindi:answers-seen` key on returning devices.** It is
  now read by nothing and cleared by the existing sign-out sweep, so it ages out
  on its own. No migration, because there is no data anybody can be shown.

## What this does NOT decide

**Whether the product wants reply notification dots.** It is a reasonable feature
and the domain supports it: a Question has an `open`, `answered` lifecycle and a
Reply is readable inline. If it is built, this ADR is not the obstacle. What is
recorded here is only that a half-built implementation was carrying maintenance
cost and telling every future reader that dots existed.

The rest of ticket 33, the one Reader Course module with an authed and a Guest
adapter, remains open and is not decided here.
