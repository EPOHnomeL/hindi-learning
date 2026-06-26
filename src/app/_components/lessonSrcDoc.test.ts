import { describe, expect, it } from "vitest";
import { buildSrcDoc } from "./lessonSrcDoc";

// A stored lesson carries the legacy floating theme pill (injected by the old
// foot.html) baked into its immutable HTML.
const LESSON = `<!DOCTYPE html><html lang="en"><head></head><body><div class="wrap">hi</div>
<script>(function(){var root=document.documentElement, KEY='lesson-theme';
var btn=document.createElement('button'); btn.className='theme-toggle';
document.body.appendChild(btn);})();</script>
</body></html>`;

describe("buildSrcDoc", () => {
  it("bakes the selected theme onto the root <html> for a lesson", () => {
    const out = buildSrcDoc(LESSON, { quiz: true, theme: "dark" });
    expect(out).toContain('<html lang="en" data-theme="dark">');
  });

  it("strips the legacy floating theme pill from a stored lesson", () => {
    const out = buildSrcDoc(LESSON, { quiz: true, theme: "dark" });
    expect(out).not.toContain("theme-toggle");
    expect(out).not.toContain("lesson-theme");
  });

  it("injects the height + quiz + theme bridges before the last </body>", () => {
    const out = buildSrcDoc(LESSON, { quiz: true, theme: "dark" });
    expect(out).toContain("__lessonTheme"); // theme bridge marker
    expect(out).toContain("postMessage"); // height/quiz bridges
    // Bridges land inside the document, ahead of the closing body tag.
    expect(out.indexOf("__lessonTheme")).toBeLessThan(out.lastIndexOf("</body>"));
  });

  it("bakes light theme and still strips the pill", () => {
    const out = buildSrcDoc(LESSON, { quiz: true, theme: "light" });
    expect(out).toContain('data-theme="light"');
    expect(out).not.toContain("theme-toggle");
  });

  it("leaves a reference untouched: no theme, no quiz/theme bridge, height only", () => {
    const ref = `<!DOCTYPE html><html lang="en"><head></head><body><p>ref</p></body></html>`;
    const out = buildSrcDoc(ref, { quiz: false });
    expect(out).not.toContain("data-theme");
    expect(out).not.toContain("__lessonTheme"); // no theme bridge
    expect(out).not.toContain("data-correct"); // no quiz bridge
    expect(out).toContain("reportHeight"); // height bridge still present
  });
});
