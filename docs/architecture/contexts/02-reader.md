---
slug: reader
name: Reader
position: 2
status: draft
adrs: [0001, 0007, 0011, 0012]
---

# Reader

The web app the learner actually touches: a Next.js client that serves each [[Lesson]] read-only in a
sandboxed iframe, themes it to match the app, and captures [[Response]]s, [[Progress]] and
[[Question]]s back to the [Hub](01-hub-content.md). There is no live tutor — the conversation is
asynchronous ([ADR 0001](/docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md)).

## Entry & navigation

[page.tsx](/src/app/page.tsx#L7-L21) renders by auth state: `Unauthenticated → SignIn`,
`Authenticated → Dashboard`; [middleware.ts](/src/middleware.ts) keeps the Convex Auth session in
sync. [Dashboard.tsx](/src/app/_components/Dashboard.tsx#L29) is a local state machine — a course grid
until a Topic is opened, then it mounts [Reader.tsx](/src/app/_components/Reader.tsx#L56), which
defaults to the first lesson.

> Navigation is **client state today** — a single page, views chosen by `useState`, no deep-linkable
> URLs. [ADR 0012](/docs/adr/0012-app-router-url-addressable-navigation.md) records the decision to
> move to real App Router routes; that work is not yet live.

## Lessons in a sandbox

A Lesson is authored HTML, fetched and dropped into an iframe via `srcDoc` with
`sandbox="allow-scripts"` ([ArtifactView.tsx:81](/src/app/_components/ArtifactView.tsx#L81-L88)) — no
same-origin access, so **all parent↔lesson communication is `postMessage`**.
[`buildSrcDoc`](/src/app/_components/lessonSrcDoc.ts#L113-L128) injects three bridges before
`</body>` (located with `lastIndexOf` so a `</body>` inside a comment can't fool it):

- **HEIGHT_BRIDGE** ([lessonSrcDoc.ts:17](/src/app/_components/lessonSrcDoc.ts#L17-L28)) — reports content
  height so mobile scrolls the page as one surface, not a nested iframe.
- **QUIZ_BRIDGE** ([lessonSrcDoc.ts:30](/src/app/_components/lessonSrcDoc.ts#L30-L52)) — posts quiz answers out.
- **THEME_BRIDGE** ([lessonSrcDoc.ts:54](/src/app/_components/lessonSrcDoc.ts#L54-L61)) — applies a live theme.

## Theme bridge

The app theme lives in [ThemeContext.tsx](/src/app/_components/ThemeContext.tsx#L11-L36) (localStorage
+ a pre-paint script in [layout.tsx](/src/app/layout.tsx#L34-L38) to avoid a flash). The **initial**
theme is baked into the srcDoc; **changes** are pushed into the live iframe by `postMessage`
([ArtifactView.tsx:51](/src/app/_components/ArtifactView.tsx#L51-L54)) — no reload, so scroll and quiz
state survive ([ADR 0011 — app-driven theme](/docs/adr/0011-app-driven-theme-into-sandboxed-lesson-iframe.md)).

## Capture surface

Three writes, all in [capture.ts](/convex/capture.ts#L28-L86), all auth-gated and owner-scoped:

| Trigger | Mutation | Note |
| --- | --- | --- |
| Quiz answered | [`recordResponse`](/convex/capture.ts#L28-L42) | **First answer only**, enforced server-side ([capture.ts:33](/convex/capture.ts#L33-L39)); re-clicks are idempotent. |
| Lesson opened / "Mark complete" | [`setProgress`](/convex/capture.ts#L44) | Never downgrades `completed → opened`. |
| Question submitted | [`askQuestion`](/convex/capture.ts#L80) | Creates an `open` [[Question]] for the teacher. |

## Gotchas

- **Sandbox is `allow-scripts` only.** The parent cannot read the lesson DOM; everything is
  `postMessage`. A bridge injected at the wrong `</body>` silently breaks (e.g. height never reported).
- **Theme toggle does not rebuild the srcDoc** — `themeRef` is a ref, not a dep, so a toggle only fires
  a `postMessage` ([ArtifactView.tsx:42](/src/app/_components/ArtifactView.tsx#L42-L54)).
- **The "Generate next lesson" button gates on the [[Frontier]].** It renders only on the highest-seq
  lesson once completed; the [Teaching Routine](03-teaching-routine.md)'s `generationStatus` disables it
  while generating / rate-limited, but the real gate is server-side.
- **Seen-reply dots are client-only** ([Reader.tsx:14](/src/app/_components/Reader.tsx#L14-L43)) — stored
  in localStorage, per-device, never synced.
