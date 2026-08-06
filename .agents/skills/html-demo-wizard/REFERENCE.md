# HTML Demo Wizard: Reference Manual

This guide covers the technical implementation guidelines for responsive virtual mouse positioning, SVG charts scaling, and autoplay timelines.

## 1. Mouse coordinate math & positioning

To make the virtual cursor movement immune to browser window resizing and container flex shifts:

1. **Target Elements by Selector**: Instead of hardcoding static page positions (e.g. `x=300, y=500`), resolve the target coordinates dynamically at runtime using `getBoundingClientRect()` relative to the mock-browser viewport.
2. **Calculate Center Coordinates**:
   ```javascript
   function getElementBrowserCoords(selector) {
     const el = document.querySelector(selector);
     if (!el) return { x: 100, y: 100 };
     const rect = el.getBoundingClientRect();
     const browserEl = document.querySelector(".mock-browser");
     const browserRect = browserEl.getBoundingClientRect();
     return {
       x: rect.left + rect.width / 2 - browserRect.left,
       y: rect.top + rect.height / 2 - browserRect.top,
     };
   }
   ```
3. **Smooth Cursor Easings**: Use cubic-bezier easings (e.g. `easeInOutCubic`) inside `requestAnimationFrame` interpolation loops for smooth, natural movement.

---

## 2. Responsive SVG composed charts

To prevent charts from looking compressed or overflowing the borders of parent cards:

- **Set explicit viewBox ratios**: Standardize on `900 200` (4.5:1) for wide layout cards and `500 200` (2.5:1) for grid column cards.
- **Set rigid container height**: Define a fixed container height (e.g., `height: 160px;`) and use flexbox or `margin-top: auto` on the wrapper, with `width: 100%; height: 100%;` on the SVG itself.
- **Symmetric element positioning**:
  Spreading $N$ double-bar columns symmetrically across a `900` units viewport:
  $$\text{Margin} = 60$$
  $$\text{Span} = 900 - 2 \times \text{Margin} = 780$$
  $$\text{Delta} = \frac{\text{Span}}{N - 1}$$
  For 7 columns: $\text{Delta} = 110$. Centers will map to: `110, 220, 330, 440, 550, 660, 770`.

---

## 3. Dynamic Tooltips on hover

To implement tooltips tracking mouse coordinates on line charts:

1. Interpolate the target X coordinate to match the line coordinates.
2. Position the tooltip `div` relative to the chart element:

   ```javascript
   function positionTooltipAtChartPoint(chartX, chartY) {
     const svg = document.getElementById("svg-chart");
     const svgRect = svg.getBoundingClientRect();
     const browserEl = document.querySelector(".mock-browser");
     const browserRect = browserEl.getBoundingClientRect();

     const scaleX = svgRect.width / 500; // viewBox width
     const scaleY = svgRect.height / 200; // viewBox height

     const tooltip = document.getElementById("chart-tooltip");
     tooltip.style.left = `${svgRect.left - browserRect.left + chartX * scaleX + 12}px`;
     tooltip.style.top = `${svgRect.top - browserRect.top + chartY * scaleY - 20}px`;
     tooltip.style.opacity = "1";
   }
   ```

---

## 4. Canvas UI shader effects over live demos

[Canvas UI](https://canvasui.dev/docs) ([repo](https://github.com/DavidHDev/canvas-ui)) runs
GPU shaders over **real, interactive HTML** using the experimental `html-in-canvas` API: the canvas
lays out and paints live DOM content, and that painted output becomes a texture the shader samples.
No screenshots, no iframes, no image conversion — the elements stay in the DOM, so pointer events,
keyboard focus, accessibility, and text searchability all survive the effect.

### Installing an effect

Components are distributed through a shadcn-compatible registry — the CLI copies a single
standalone source file into the project, so effects are versioned assets in the repo, not a runtime
dependency:

```bash
npx shadcn@latest add @canvas-ui/<component>-<framework>
```

`<framework>` is one of `react`, `solid`, `preact`, `vue`, `svelte`, or `vanilla`. For the
standalone demo pages this skill produces, use `vanilla`. Because a registry backs it, an agent
with the shadcn MCP server wired up can browse the catalogue and install a component by name.

### Effect catalogue (40+ components)

| Category | Examples | Good for |
| --- | --- | --- |
| Distortion / glitch | `vhs`, `glitch`, `displacement`, `ripple` | Retro or "system under load" framing |
| Fluid | `liquid`, `droplets` | Rain / water passes over a hero shot |
| Surface | `glass`, `frost` | Frosted overlays on modals and side panels |
| Destructive | `shatter`, `flame-wrap`, `particle-reveal` | Transitions between demo views |

Many are pure 3D/shader work and run in every browser today; only the ones that sample DOM content
need `html-in-canvas`.

### Browser support and graceful degradation

`html-in-canvas` is an experimental Chrome feature in origin trial. Components detect support at
runtime: without it, the content renders as ordinary HTML and whatever part of the effect can still
run, does. Rules for demos:

1. Never put demo-critical information (labels, numbers, CTAs) *only* in the shader layer.
2. Screenshot the demo with effects disabled and confirm it still reads as a finished product.
3. Assume the client's browser is the unsupported one — the fallback is the real deliverable.

---

## 5. Rendering the demo as video, in code

Combine section 4 with a programmatic video renderer (Remotion, Hyperframes) to *code* the demo
video rather than record it. This makes the output deterministic and cheap to regenerate whenever
the UI changes.

- **Reuse the timeline as the storyboard.** The `timeline` array from SKILL.md step 3 already has
  step durations; convert them to frame ranges at the render fps (e.g. 3000 ms at 30 fps = 90
  frames) instead of maintaining a second sequence.
- **Drive the cursor from frame number, not wall clock.** Replace `requestAnimationFrame` timing
  with the renderer's current-frame value so each frame is reproducible under parallel rendering.
- **Keep effects declarative.** A shader pass configured by props is a diffable parameter, so
  iterating on look-and-feel is a code edit and a re-render, not a manual re-edit.
- **Verify shader support in the render environment.** Headless capture may lack the origin-trial
  flag; if the effect matters to the cut, confirm it renders in a test frame before rendering the
  whole timeline.
