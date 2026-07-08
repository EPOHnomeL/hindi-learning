# 01 — ArticleSkeleton for the lesson/reference readers

Status: ready-for-agent

Spec: ../PRD.md

## Summary

Replace the bare `Loading…` text in the two article readers with a shared,
layout-mimicking skeleton while the article body is loading.

## Changes

1. Add a presentational `ArticleSkeleton` component to the shared UI primitives
   module (`src/app/_components/ui.tsx`), mirroring the readers' two-column shell:
   - Outer `flex flex-col gap-4 md:h-full md:flex-row`.
   - Main column: a title-bar-height placeholder block, then ~6–8 paragraph-line
     placeholders of varying widths standing in for the article body.
   - Desktop-only aside: `hidden shrink-0 md:block md:w-80` with a
     question-box-shaped placeholder.
   - Styling: `animate-pulse` + `rounded-… border border-line bg-card`, matching
     the existing dashboard/admin placeholders. No new tokens or colors.
   - Purely visual — no `aria-*` attributes.

2. In `ArtifactView` (`src/app/_components/ArtifactView.tsx`), change the
   `lesson === undefined || html === undefined` branch to return `<ArticleSkeleton />`
   instead of `<p className="text-soft">Loading…</p>`. Leave the two `=== null`
   branches (not found / couldn't load) exactly as they are.

3. In `PublicLessonPane` (`src/app/_components/PublicReader.tsx`), make the same
   swap on its `lesson === undefined || html === undefined` branch. Leave its
   `=== null` branches unchanged.

## Acceptance criteria

- Opening a lesson or reference (signed-in and via `/share`) shows the
  laid-out skeleton while the body loads, and content fills in place without the
  page jumping from a single text line to the full layout.
- On desktop the skeleton includes the question-aside placeholder; on mobile it
  is single-column.
- A genuinely missing or failed lesson still shows the existing plain-text
  not-found / error message — never an endless skeleton.
- No other loading state in the app changes.

## Testing

No automated test (see PRD Testing Decisions). Verify visually in the running app.

## Out of scope

Everything in the PRD's Out of Scope section — in particular, no other surface's
loading state, no spinners/Suspense/route-level loading files, no a11y attributes.

## Implementation notes

- Component named `ReaderSkeleton` (not `ArticleSkeleton`): the domain glossary
  (`CONTEXT.md`) lists "article" as a forbidden synonym for **Lesson**.
- The PRD's claim that lessons and references share one two-column shell was
  wrong: references (signed-in and public) are single-column with no question
  aside. `ReaderSkeleton` takes an optional `aside` prop (default `true`);
  reference panes pass `aside={false}` for a single-column skeleton.
- For consistency, the skeleton was applied to all four reader loading branches
  in the two files — lesson + reference, signed-in + public — not only the
  public *lesson* pane the issue originally named. Same two files, same reader
  surface; leaving references as bare "Loading…" text would look inconsistent.
