---
name: html-demo-wizard
description: Create high-fidelity standalone HTML interactive product demos and autoplay user-flow simulations. Use when building client-facing demo pages, interactive mockups, or custom scroll/click timeline animations.
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

## Advanced Features

For advanced cursor tracking, responsive SVG charts, and hover tooltips:
See [REFERENCE.md](REFERENCE.md)
