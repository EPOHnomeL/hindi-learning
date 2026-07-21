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
