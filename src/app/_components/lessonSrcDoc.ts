import { isDevanagari } from "../../../convex/languages";

export type Theme = "light" | "dark";

// Injected into the iframe. Three concerns, kept separate:
//  - HEIGHT_BRIDGE (always): posts the document's content height so the parent
//    can size the iframe to fit. On mobile that makes the whole PAGE the single
//    scroll surface (no nested iframe scroll), so the browser chrome is free to
//    collapse and the lesson gets the full screen.
//  - QUIZ_BRIDGE (lessons only): reads the AUTHORED quiz markup (.quiz[data-correct]
//    + .opt[data-k], and .quiz.fill[data-answer]) and posts the learner's answer,
//    so lessons stay self-contained with no API calls of their own. First-answer-
//    only is enforced server-side, so re-clicks are harmless.
//  - THEME_BRIDGE (lessons only): the lesson runs in a sandboxed iframe (no
//    same-origin) so the parent can't touch its DOM. The app owns theming
//    (ADR 0011); this listens for a postMessage and flips data-theme live, so a
//    toggle re-skins the lesson WITHOUT a reload (scroll + quiz state survive).
//    The initial theme is baked into the HTML by buildSrcDoc, so there's no flash.
const HEIGHT_BRIDGE = `<script>(function(){
  function post(m){ try{ parent.postMessage(Object.assign({__lesson:true}, m), '*'); }catch(e){} }
  function reportHeight(){
    var doc=document.documentElement;
    post({type:'height', height: Math.max(document.body?document.body.scrollHeight:0, doc.scrollHeight)});
  }
  window.addEventListener('load', reportHeight);
  window.addEventListener('resize', reportHeight);
  if(window.ResizeObserver){ try{ new ResizeObserver(reportHeight).observe(document.documentElement); }catch(e){} }
  setTimeout(reportHeight, 100);
  setTimeout(reportHeight, 600);
}());<\/script>`;

const QUIZ_BRIDGE = `<script>(function(){
  function post(m){ try{ parent.postMessage(Object.assign({__lesson:true}, m), '*'); }catch(e){} }
  document.querySelectorAll('.quiz[data-correct]').forEach(function(quiz,i){
    var id = quiz.id || ('quiz-'+i);
    var correct = quiz.getAttribute('data-correct');
    quiz.querySelectorAll('.opt[data-k]').forEach(function(opt){
      opt.addEventListener('click', function(){
        var k = opt.getAttribute('data-k');
        post({type:'response', quizId:id, answer:k, correct: k===correct});
      });
    });
  });
  // Case- and whitespace-insensitive, matching the in-lesson visual layer
  // (foot.html) so what the learner SEES and what we capture always agree.
  function normFill(s){ return (s||'').replace(/\\s+/g,' ').trim().toLowerCase(); }
  document.querySelectorAll('.quiz.fill[data-answer]').forEach(function(quiz,i){
    var id = quiz.id || ('fill-'+i);
    var answer = normFill(quiz.getAttribute('data-answer'));
    var input = quiz.querySelector('input');
    var btn = quiz.querySelector('[data-check]') || quiz.querySelector('button');
    if(btn && input) btn.addEventListener('click', function(){
      var v=normFill(input.value);
      post({type:'response', quizId:id, answer:input.value, correct: v===answer});
    });
  });
}());<\/script>`;

const THEME_BRIDGE = `<script>(function(){
  window.addEventListener('message', function(e){
    var d=e.data;
    if(d && d.__lessonTheme && (d.theme==='dark'||d.theme==='light')){
      document.documentElement.setAttribute('data-theme', d.theme);
    }
  });
}());<\/script>`;

// NAV_BRIDGE (all artifacts): the artifact runs in a sandboxed iframe with only
// `allow-scripts` — no allow-top-navigation, no allow-same-origin. A bare <a>
// click therefore navigates the IFRAME, not the app: an internal /courses link
// would reload the whole app into the opaque-origin sandbox (auth/localStorage
// then throw → "client-side exception"), and external links get refused by their
// frame-ancestors policy. So intercept clicks and hand the resolved href to the
// parent, which routes internal links via the app router and opens external ones
// in a new tab. In-page (#fragment) links are left alone so they still scroll.
const NAV_BRIDGE = `<script>(function(){
  function post(m){ try{ parent.postMessage(Object.assign({__lesson:true}, m), '*'); }catch(e){} }
  function onClick(e){
    if(e.type==='auxclick' && e.button!==1) return; // only middle-click among aux buttons
    if(e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    var raw = a.getAttribute('href') || '';
    if(raw.charAt(0)==='#') return; // in-page anchor — let it scroll within the frame
    var href = a.href; // resolved against the parent document's base URL
    if(!/^https?:/i.test(href)) return; // ignore mailto:, tel:, javascript:, etc.
    e.preventDefault();
    var newTab = e.metaKey || e.ctrlKey || e.shiftKey || e.button===1 || a.target==='_blank';
    post({type:'navigate', href: href, newTab: newTab});
  }
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', onClick, true);
}());<\/script>`;

// The message the parent posts to an iframe's THEME_BRIDGE to re-skin it live.
export function themeMessage(theme: Theme): { __lessonTheme: true; theme: Theme } {
  return { __lessonTheme: true, theme };
}

// Dark palette for References. Unlike lessons (whose dark CSS ships in head.html),
// references are raw authored HTML carrying only a light :root{} palette plus a
// few hardcoded light colors. This override flips the shared CSS variables AND
// the hardcoded surfaces/borders/near-black text used by the reference design
// system (header.ref, .term, .word) so they stay legible in dark — ADR 0011.
const REFERENCE_DARK_CSS = `<style>
:root[data-theme="dark"]{--ink:#e9e1d4; --soft:#a99d8a; --paper:#1b1815; --card:#241f1a; --accent:#dd9863; --accent2:#79b39b; --gold:#d8ab57; --hi:#4a3c1f;}
:root[data-theme="dark"] header.ref{border-color:#3a322a}
:root[data-theme="dark"] .term{border-color:#3a322a}
:root[data-theme="dark"] .term .name{color:#f3ecdf}
:root[data-theme="dark"] .term .avoid{border-top-color:#3a322a}
:root[data-theme="dark"] .term .avoid b{color:#e0937c}
:root[data-theme="dark"] .word{border-bottom-color:#3a322a}
</style>`;

// Inject the reference dark palette before </head> so it applies before paint.
function injectReferenceDarkCss(html: string): string {
  const i = html.indexOf("</head>");
  return i === -1 ? REFERENCE_DARK_CSS + html : html.slice(0, i) + REFERENCE_DARK_CSS + html.slice(i);
}

// A translated Edition swaps the lesson's prose text nodes for the target
// language, but the design system's body font — 'Spectral',Georgia,'Times New
// Roman' — has no Devanagari glyphs. So a Hindi/Marathi/Nepali Edition's prose
// fell through to the browser's default Devanagari face at a size tuned for
// Latin: small and cramped (course-translation). Three parts, for the whole
// Devanagari-script set:
//  - load the same Noto Devanagari faces the taught content (.deva/.verse/.word)
//    already uses. Lessons ship this <link> in head.html already (a duplicate is
//    harmless — the browser dedupes); References don't, so this covers both.
//  - splice those faces into the body chain AFTER 'Spectral', so per-glyph
//    fallback keeps Latin (proper nouns, code) in Spectral while Devanagari
//    resolves to Noto; nudge line-height up for matra/conjunct clearance.
//  - scale the WHOLE lesson up with `zoom`. Devanagari reads ~2px smaller than
//    Latin at the same font-size, and the design system sizes everything in px
//    (not rem), so there's no root knob to grow text from — and bumping only the
//    body font-size leaves the notes/quiz/recap chrome small. `zoom` scales the
//    entire px scale uniformly and, unlike `transform:scale`, still contributes
//    to layout height, so the iframe's HEIGHT_BRIDGE measures the scaled document
//    correctly. Tune the factor here if it reads too large/small.
const DEVANAGARI_CSS = `<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&display=swap" rel="stylesheet">
<style>html{zoom:1.2;}
html body{font-family:'Spectral','Noto Serif Devanagari','Noto Sans Devanagari',Georgia,serif; line-height:1.75;}</style>`;

// Inject the Devanagari font + zoom before </head> so it applies before paint.
function injectDevanagariCss(html: string): string {
  const i = html.indexOf("</head>");
  return i === -1 ? DEVANAGARI_CSS + html : html.slice(0, i) + DEVANAGARI_CSS + html.slice(i);
}

// Some authored references arrive as a bare fragment (e.g. `<section
// class="glossary">…</section>`) with all page styling scoped to that element,
// not a full <html> document. The rest of this pipeline assumes a document:
// setRootTheme, the dark-CSS injection (before </head>) and the bridge injection
// (before </body>) all silently no-op on a fragment, so the theme never bakes and
// — worse — nothing paints the document `body`, leaving the iframe's default white
// canvas showing around the content (the fragment reads as a narrow card floating
// on white instead of a full-bleed page like the well-formed references). Wrap any
// fragment in a minimal document: a viewport meta (device-width on mobile) and a
// body carrying the reference paper background (theme-aware, matching
// REFERENCE_DARK_CSS) so it renders full-bleed and consistent with the others.
const FRAGMENT_HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0}body{background:#fbf7f0}:root[data-theme="dark"] body{background:#1b1815}</style>`;

function ensureDocument(html: string): string {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!DOCTYPE html><html lang="en"><head>${FRAGMENT_HEAD}</head><body>${html}</body></html>`;
}

// Bake the selected theme onto the root <html> so the lesson renders in the
// right palette with no flash.
function setRootTheme(html: string, theme: Theme): string {
  return html.replace(/<html\b([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s+data-theme=(["']).*?\1/i, "");
    return `<html${cleaned} data-theme="${theme}">`;
  });
}

// Bake the served Edition's text direction + language onto the root <html>, so a
// translated lesson renders RTL and with the right `lang` for hyphenation/screen
// readers (course-translation). Mirrors setRootTheme: strip any authored dir/lang
// and stamp the Edition's. The stored lesson HTML ships `<html lang="en">`, which
// this overwrites for a translated Edition.
function setRootDirLang(html: string, dir?: "ltr" | "rtl", lang?: string): string {
  if (!dir && !lang) return html;
  return html.replace(/<html\b([^>]*)>/i, (_m, attrs: string) => {
    let cleaned = attrs;
    if (dir) cleaned = cleaned.replace(/\s+dir=(["']).*?\1/i, "");
    if (lang) cleaned = cleaned.replace(/\s+lang=(["']).*?\1/i, "");
    return `<html${cleaned}${dir ? ` dir="${dir}"` : ""}${lang ? ` lang="${lang}"` : ""}>`;
  });
}

// Already-published lessons are immutable (ADR 0003), so their HTML still carries
// the old floating theme pill (the <script> that injected a `.theme-toggle` button
// and auto-darkened from the OS). The app now owns theming (ADR 0011), so strip
// that legacy script at render time — this fixes existing lessons too, not just
// ones republished after foot.html changed.
function stripLegacyThemePill(html: string): string {
  return html.replace(/<script>(?:(?!<\/script>)[\s\S])*?theme-toggle[\s\S]*?<\/script>/gi, "");
}

// Assemble the iframe document for a served artifact from its stored HTML.
// Every artifact gets the height + nav bridges (the nav bridge forwards link
// clicks to the parent so cross-lesson/external links work despite the sandbox).
// `quiz` adds the answer-capture bridge (lessons, not references). `theme`, when
// given, makes the artifact app-themed: the legacy pill is stripped, the initial
// theme is baked in, and the theme bridge is added so the parent can flip it live.
// `themeCss` additionally injects the dark palette — set for References, which
// (unlike lessons) don't bundle their own dark CSS. ADR 0011. `dir`/`lang`, when
// given, stamp the served Edition's text direction + language onto <html> so a
// translated Edition renders RTL/localised (course-translation); a Devanagari
// `lang` also gets the Devanagari font + size bump so its prose is legible.
export function buildSrcDoc(
  html: string,
  opts: { quiz: boolean; theme?: Theme; themeCss?: boolean; dir?: "ltr" | "rtl"; lang?: string },
): string {
  let doc = ensureDocument(html);
  if (opts.theme) {
    doc = stripLegacyThemePill(doc);
    doc = setRootTheme(doc, opts.theme);
    if (opts.themeCss) doc = injectReferenceDarkCss(doc);
  }
  doc = setRootDirLang(doc, opts.dir, opts.lang);
  if (opts.lang && isDevanagari(opts.lang)) doc = injectDevanagariCss(doc);
  const scripts = HEIGHT_BRIDGE + NAV_BRIDGE + (opts.quiz ? QUIZ_BRIDGE : "") + (opts.theme ? THEME_BRIDGE : "");
  // Inject before the LAST </body>. A first-match replace is unsafe: an assembled
  // lesson can carry an authoring comment (or a code sample) that contains a
  // literal "</body>" earlier in the document, and injecting there would bury the
  // bridge scripts inside it — inert, so the iframe never reports its height (ask
  // box overlaps) and quiz answers aren't captured.
  const i = doc.lastIndexOf("</body>");
  return i === -1 ? doc + scripts : doc.slice(0, i) + scripts + doc.slice(i);
}

// The srcDoc for the owner's in-place editor (course-content-editing). Same
// authored CSS/layout as the reader — but NONE of the reader's bridge scripts.
// The editor iframe is `sandbox="allow-same-origin"` (no allow-scripts), so the
// lesson's own scripts don't run and the DOM stays exactly as authored: reading
// `contentDocument.body.innerHTML` back after editing yields a faithful body with
// no injected cruft. The parent turns on `designMode` to make it editable (a DOM
// property, so it needs no script and leaves no `contenteditable` attribute to
// strip). Theme is baked for display only; the read-back takes body content, not
// the <html> tag, so the baked `data-theme` never reaches the saved HTML.
export function buildEditDoc(html: string, opts: { theme?: Theme; themeCss?: boolean } = {}): string {
  let doc = ensureDocument(html);
  if (opts.theme) {
    doc = stripLegacyThemePill(doc);
    doc = setRootTheme(doc, opts.theme);
    // References carry no dark palette of their own, so inject it for the editor
    // just like the reader's Frame does (ADR 0011). Head-only, so the body
    // read-back on save is unaffected.
    if (opts.themeCss) doc = injectReferenceDarkCss(doc);
  }
  return doc;
}

// Splice an edited body's inner HTML back into the authored document, preserving
// the head, the `<body …>` attributes, and the doctype/`<html>` wrapper exactly —
// only the body's contents change. A plain string splice (not DOMParser) so the
// rest of the document round-trips byte-for-byte; mirrors buildSrcDoc's
// lastIndexOf("</body>") guard against a stray literal "</body>" earlier in the
// document.
export function replaceBodyInner(html: string, inner: string): string {
  const doc = ensureDocument(html);
  const open = doc.match(/<body\b[^>]*>/i);
  const close = doc.lastIndexOf("</body>");
  if (!open || open.index === undefined || close === -1) return doc; // malformed → leave unchanged
  const openEnd = open.index + open[0].length;
  return doc.slice(0, openEnd) + inner + doc.slice(close);
}
