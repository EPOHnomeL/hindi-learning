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

Navigation is now **real, URL-addressable App Router routes** ([ADR 0012](/docs/adr/0012-app-router-url-addressable-navigation.md)
— shipped). [page.tsx](/src/app/page.tsx) is the ungated front door (`Landing` signed-out, `Dashboard`
signed-in, same `/` URL). The reader itself lives under an auth-gated route group:

- `(app)/courses/[slug]/lessons/[key]` and `.../references/[key]` — the signed-in reader.
  [`AppGate`](/src/app/_components/AppGate.tsx) renders `<SignIn>` *at the deep-link URL* while signed
  out rather than redirecting, and [`CourseShell`](/src/app/_components/CourseShell.tsx) is a persistent
  sidebar that stays mounted across lessons (frontier, `canWrite`/`canEdit`, next-key, dir, Edition
  switcher).
- `share/[token]/…` — the anonymous [[Guest]] reader (outside the auth group; the token is the only
  credential; `robots:noindex` + `referrer:no-referrer`).
- `certificate/[token]` — the standalone anonymous [[Certificate]] page.

[middleware.ts](/src/middleware.ts) keeps the Convex Auth session in sync. `CourseIndex` waits for both
`listLessons` and `courseHeader` before choosing a redirect target, so an owner resumes at the
[[Frontier]] rather than flashing through lesson 1.

## Lessons in a sandbox

A Lesson is authored HTML (fetched from its content blob — see below) dropped into an iframe via
`srcDoc` with `sandbox="allow-scripts"` ([ArtifactView.tsx](/src/app/_components/ArtifactView.tsx)) — no
same-origin access, so **all parent↔lesson communication is `postMessage`**.
[`buildSrcDoc`](/src/app/_components/lessonSrcDoc.ts) injects four bridges before the **last**
`</body>` (located with `lastIndexOf` so a `</body>` inside a comment can't fool it), and bakes in the
Edition's `dir`/`lang` (+ Devanagari webfont for that script):

- **HEIGHT_BRIDGE** — reports content height so mobile scrolls the page as one surface, not a nested iframe.
- **QUIZ_BRIDGE** — reads the authored `data-correct`/`data-k`/`data-answer`/`data-alt` markers and posts answers out.
- **THEME_BRIDGE** — applies a live theme without reload.
- **NAV_BRIDGE** — intercepts in-lesson `<a>` clicks (the sandbox has no top-navigation) and forwards
  them to the parent, which routes internal links and rewrites `/courses/…` → `/share/…` for [[Guest]]s.

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

## Content, Editions & certificates

- **HTML is a content blob.** `getLesson`/`getReference` return a `contentUrl` (a `GET /content?id=…`
  route, `Cache-Control: immutable`); `useContentHtml` fetches it. See [Hub & Content Model](01-hub-content.md).
- **Edition switching.** The shell resolves the served language via the Hub's `readableLang` and offers a
  switcher over the [[Edition]]s the caller holds (`?lang=xx`, honoured only if held). A missing
  translation falls back to the English source per item. See [Access & Sharing](05-access-sharing.md).
- **Certificates.** On a completed course the reader offers a [[Certificate]]; "View" opens
  `/certificate/[token]` (a real anchor — `window.open` popups were blocked on the deployed domain).

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
