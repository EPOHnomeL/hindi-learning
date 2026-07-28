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

  it("leaves a reference untouched when no theme is given: height bridge only", () => {
    const ref = `<!DOCTYPE html><html lang="en"><head></head><body><p>ref</p></body></html>`;
    const out = buildSrcDoc(ref, { quiz: false });
    expect(out).not.toContain("data-theme");
    expect(out).not.toContain("__lessonTheme"); // no theme bridge
    expect(out).not.toContain("data-correct"); // no quiz bridge
    expect(out).toContain("reportHeight"); // height bridge still present
  });

  it("injects the nav bridge into every artifact (lesson and reference)", () => {
    // Links inside the sandboxed iframe can't navigate the app on their own, so
    // the click-forwarding bridge must ship with every artifact regardless of
    // quiz/theme options.
    const lesson = buildSrcDoc(LESSON, { quiz: true, theme: "dark" });
    expect(lesson).toContain("type:'navigate'");
    const ref = `<!DOCTYPE html><html lang="en"><head></head><body><a href="/courses/x/lessons/0001-y">L1</a></body></html>`;
    const out = buildSrcDoc(ref, { quiz: false });
    expect(out).toContain("type:'navigate'"); // forwards clicks even with no quiz/theme
    expect(out).toContain("auxclick"); // middle-click handled too
    expect(out.indexOf("type:'navigate'")).toBeLessThan(out.lastIndexOf("</body>"));
  });

  it("serves a Devanagari Edition in the Noto Devanagari webfont, into <head>", () => {
    const out = buildSrcDoc(LESSON, { quiz: true, dir: "ltr", lang: "hi" });
    expect(out).toContain('lang="hi"'); // Edition lang stamped
    expect(out).toContain("Noto+Serif+Devanagari"); // webfont link
    expect(out).toContain("'Noto Serif Devanagari'"); // spliced into the body chain
    expect(out).toContain("zoom:1.2"); // whole-lesson scale-up for the script
    // Font override must land inside <head> so it applies before the body renders.
    expect(out.indexOf("Noto Serif Devanagari")).toBeLessThan(out.indexOf("</head>"));
  });

  it("resolves the script from the base subtag and covers Marathi too", () => {
    expect(buildSrcDoc(LESSON, { quiz: true, lang: "hi-IN" })).toContain("'Noto Serif Devanagari'");
    expect(buildSrcDoc(LESSON, { quiz: true, lang: "mr" })).toContain("'Noto Serif Devanagari'");
  });

  it("leaves a Latin-script Edition's font untouched", () => {
    const out = buildSrcDoc(LESSON, { quiz: true, dir: "ltr", lang: "es" });
    expect(out).toContain('lang="es"');
    expect(out).not.toContain("Noto Serif Devanagari"); // no font override for Spanish
  });

  it("wraps a fragment reference in a full document so theming + full-bleed background attach", () => {
    // Some authored references are a bare fragment (e.g. `<section class="glossary">…`)
    // with all styling scoped to that element rather than a full <html> document.
    // Without a document, setRootTheme/dark-CSS/script injection all no-op and the
    // iframe body keeps the browser-default white — the content floats as a narrow
    // card on white instead of a full-bleed page like the well-formed references.
    const fragment = `<section class="glossary"><h1>Terms</h1><p>hi</p></section>`;
    const out = buildSrcDoc(fragment, { quiz: false, theme: "light", themeCss: true });
    expect(out).toContain("<html"); // wrapped into a real document
    expect(out).toContain('data-theme="light"'); // theme now bakes onto the synthesized <html>
    expect(out).toContain("__lessonTheme"); // theme bridge attaches (needs </body>)
    expect(out).toContain(':root[data-theme="dark"]'); // dark palette injected into synthesized <head>
    expect(out).toContain('class="glossary"'); // original content preserved
    // The synthesized body carries the paper background so the page is full-bleed,
    // and a viewport meta so it renders at device width on mobile.
    expect(out).toContain("initial-scale=1");
    expect(out).toMatch(/body\s*\{[^}]*background/);
  });

  it("leaves a full-document reference un-wrapped (no double <html>)", () => {
    const ref = `<!DOCTYPE html><html lang="en"><head><style>:root{--paper:#fbf7f0}</style></head><body><p>ref</p></body></html>`;
    const out = buildSrcDoc(ref, { quiz: false, theme: "light", themeCss: true });
    expect(out.match(/<html/gi)?.length).toBe(1); // still exactly one <html>
  });

  it("injects a tenant palette as bare :root vars into <head> when tenantPalette is given", () => {
    // The lesson design system reads bare --<t> vars (not the app chrome's --color-*),
    // so the override moves the 14 tokens for the surfaces those vars drive (issue 13).
    const palette = { light: { paper: "#111111", accent: "#222222" }, dark: { paper: "#000000" } };
    const out = buildSrcDoc(LESSON, { quiz: true, theme: "light", tenantPalette: palette });
    expect(out).toContain("--paper:#111111"); // bare var, matching head.html
    expect(out).not.toContain("--color-paper"); // NOT the app-chrome prefix
    expect(out).toContain(':root:root[data-theme="dark"]'); // partial dark override
    expect(out).toContain("--paper:#000000");
    // Must land inside <head> so it applies before the body renders (no flash).
    expect(out.indexOf("--paper:#111111")).toBeLessThan(out.indexOf("</head>"));
  });

  it("injects no tenant palette when tenantPalette is absent (default site unchanged)", () => {
    const out = buildSrcDoc(LESSON, { quiz: true, theme: "light" });
    expect(out).not.toContain(":root:root"); // no tenant palette block
  });

  it("paints quiz option labels in ink, without stealing an answered option's state colour", () => {
    // `.opt` is a <button>: head.html gives it `font:inherit` but no colour, so the
    // label fell through to the UA ButtonText (dim grey in dark). Carried to lessons
    // already stored with the old rule.
    const out = buildSrcDoc(LESSON, { quiz: true, theme: "dark" });
    expect(out).toContain(".opt:not(.correct):not(.wrong){color:var(--ink)}");
    // References have no options, so they don't get the rule.
    expect(buildSrcDoc(LESSON, { quiz: false, theme: "dark" })).not.toContain(".opt:not(.correct)");
  });

  it("re-points the lesson's hardcoded dark surfaces at the palette tokens for a tenant", () => {
    // head.html bakes warm-brown literals into every lesson's dark CSS (#241f1a
    // cards, #3a322a borders, #221d16 quiz options), which a token override can't
    // reach — so a cool-branded tenant got brown cards on its own dark paper.
    const out = buildSrcDoc(LESSON, { quiz: true, theme: "dark", tenantPalette: { light: { paper: "#111111" } } });
    expect(out).toContain(':root:root[data-theme="dark"] .note');
    expect(out).toContain("background:var(--card)");
    // Higher specificity than head.html's own `:root[data-theme="dark"] .opt`.
    expect(out).toContain(':root:root[data-theme="dark"] .opt');
    // Grammar colour-coding is semantic, not surface — left alone across tenants.
    expect(out).not.toContain("mark.r");
  });

  it("themes a reference: bakes theme, injects the dark palette into <head>, adds the bridge", () => {
    const ref = `<!DOCTYPE html><html lang="en"><head><style>:root{--paper:#fbf7f0}</style></head><body><div class="term"><div class="name">x</div></div></body></html>`;
    const out = buildSrcDoc(ref, { quiz: false, theme: "dark", themeCss: true });
    expect(out).toContain('data-theme="dark"'); // baked on <html>
    expect(out).toContain("__lessonTheme"); // theme bridge present
    expect(out).toContain(':root[data-theme="dark"]'); // dark palette override
    expect(out).toContain("#1b1815"); // dark --paper value
    // Palette must land inside <head> so it applies before the body renders.
    expect(out.indexOf(":root[data-theme")).toBeLessThan(out.indexOf("</head>"));
  });
});
