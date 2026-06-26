# App-driven theme, pushed into the sandboxed lesson iframe

Light/dark is no longer chosen inside the lesson. The in-lesson floating **theme pill** (a button injected by `lessons/_partials/foot.html`, with its own OS-`prefers-color-scheme` auto-init) is removed; a single app-level **Theme** setting — a Light/Dark toggle pinned at the bottom of the reader sidebar — now drives the whole product. A client `ThemeProvider` sets `data-theme` on `<html>` (persisted in `localStorage`, default Light), which themes the app chrome (reader, dashboard, sign-in) via a dark override of the color tokens, and is **pushed into the sandboxed lesson iframe** so the served HTML flips with it.

Because the iframe is `sandbox="allow-scripts"` (no same-origin), the parent cannot touch its DOM. The theme is delivered the same way the height/quiz bridges already are: the initial `data-theme` is baked into `srcDoc`, and later changes are sent via `postMessage` to a small **theme bridge** script that flips `data-theme` live — no reload, so scroll position and answered-quiz highlights survive a toggle.

## Considered options

- **Rebuild `srcDoc` on every toggle** — rejected: each theme change reloads the iframe, jumping scroll to the top and resetting in-page quiz highlighting.
- **Only fix future lessons** (edit `foot.html`, leave published lessons alone) — rejected: Lessons are immutable (ADR 0003), so already-published lessons would keep their pill and OS-auto-dark forever, ignoring the app setting.

## Consequences

- Published Lessons stay immutable, yet behave consistently: the parent **strips the old pill `<script>` at render time** (a regex over the stored HTML before assembling `srcDoc`), and injects the theme bridge + initial `data-theme`. The same render path fixes existing and future lessons. The `:root[data-theme="dark"]` palette in `head.html` is deliberately **kept** — the app now drives it; only the toggle script in `foot.html` is removed.
- References are raw authored HTML without the shared dark palette, so they remain on their light styling in dark mode — an accepted limitation.
