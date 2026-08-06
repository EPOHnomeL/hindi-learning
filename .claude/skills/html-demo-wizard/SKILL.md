---
name: html-demo-wizard
description: Create high-fidelity standalone HTML interactive product demos and autoplay user-flow simulations. Use when building client-facing demo pages, interactive mockups, custom scroll/click timeline animations, or stylized shader-effect demo videos rendered from code.
---

# HTML Demo Wizard

## Quick start

To scaffold a new high-fidelity interactive HTML demo in your project, run the helper script:

```bash
node .agents/skills/html-demo-wizard/scripts/scaffold.js apps/web/public/my-demo.html
```

This generates a responsive standalone mock-browser template with custom autoplay timeline loop controls, virtual cursor animations, and flex columns.

## Workflows

### 1. Map Out the Demo Steps

- Define the list of visual pages (views) to simulate.
- Establish the step sequence and commentary text.
- Note the selector IDs of the targets (sidebar navs, tabs, action buttons) that the virtual mouse will click.

### 2. Structure View Mockups

- Build clean semantic layouts for each `<div class="view-screen" id-screen="...">`.
- To avoid responsive layout alignment breakages in wide or high screens, use relative viewport units (`vh`, `%`, `flex`) and absolute SVG viewBox coordinate mapping instead of hardcoded layouts.
- Keep style tokens consistent (white background, harmonized dark sidebars, and premium sans-serif typography).

### 3. Program the Timeline Runner

- Customize the JS `timeline` steps.
- Set screen state transitions to execute immediately on `simulateClick()` at the end of a step.
- Set standard step static durations to `3000ms` and inter-step delays to `500ms` for smooth readability.

### 4. (Optional) Stylize with Canvas UI shader effects

When the demo needs to *look* striking — sizzle reels, launch pages, social clips — layer
[Canvas UI](https://canvasui.dev/) shader components over the running demo instead of editing a
screen recording afterwards.

- Effects are installed as source files via the shadcn CLI, so they live in the codebase as
  reusable assets: `npx shadcn@latest add @canvas-ui/<component>-<framework>`.
- Components ship for React, Solid, Preact, Vue, Svelte, and vanilla TS — the vanilla build drops
  straight into a standalone demo page.
- Effects run over **live DOM**, not a screenshot. Links, forms, focus rings, text selection, and
  screen-reader output survive, so the demo stays technically accurate while looking stylized.
- Every component detects support at runtime and degrades to plain HTML. Never gate demo content
  behind an effect — the underlying markup must read correctly with the shader off.

### 5. (Optional) Render the demo to video in code

Rather than screen-recording the autoplay timeline, drive it from a programmatic video renderer
(Remotion, Hyperframes) so the output is deterministic and re-renderable after every UI change.
The timeline built in step 3 is already the storyboard — map its step durations to frame ranges.

## Advanced Features

For advanced cursor tracking, responsive SVG charts, and hover tooltips:
See [REFERENCE.md](REFERENCE.md)

For the Canvas UI effect catalogue, browser-support caveats, and the code-the-video pipeline:
See [REFERENCE.md](REFERENCE.md#4-canvas-ui-shader-effects-over-live-demos)
