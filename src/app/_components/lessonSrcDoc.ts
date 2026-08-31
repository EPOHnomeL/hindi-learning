import { isDevanagari } from "../../../convex/languages";
import { buildTenantThemeCss, type TenantTheme } from "../../design/tokens";

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
  window.addEventListener('resize', reportHeight);
  function init(){
    if(window.ResizeObserver){ try{ new ResizeObserver(reportHeight).observe(document.documentElement); }catch(e){} }
    reportHeight();
    setTimeout(reportHeight, 100);
    setTimeout(reportHeight, 600);
  }
  if(document.readyState === 'complete'){
    init();
  } else {
    window.addEventListener('load', init);
  }
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
  function normFill(s){ return (s||'').normalize('NFC').replace(/\\s+/g,' ').trim().toLowerCase(); }
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

// REFERENCE_BRIDGE (references only): two concerns for a glossary card.
//  - Deep-link (reference-cards/02): a Lesson links `…/references/<key>#<cardId>`.
//    The card lives in a sandboxed iframe, so the parent URL hash never reaches it —
//    the parent posts a `scrollToCard` message (on load + on hash change) and this
//    scrolls the card into view and flashes a brief highlight. A missing id (old
//    reference with no ids, a deleted term) is a silent no-op.
//  - Share (reference-cards/03, only when `share`): inject a hover share button into
//    each `.term[id] / .word[id]`; on click it reads the card's term + definition
//    (by shape) and posts a `shareCard` intent — the PARENT composes the branded
//    snippet and runs clipboard/Web Share, since a sandboxed iframe can do neither.
function referenceBridge(share: boolean): string {
  return `<script>(function(){
  function post(m){ try{ parent.postMessage(Object.assign({__lesson:true}, m), '*'); }catch(e){} }
  function flash(el){
    if(!el) return;
    el.scrollIntoView({behavior:'smooth', block:'start'});
    el.classList.remove('card-flash');
    void el.offsetWidth; // restart the animation if the same card is re-targeted
    el.classList.add('card-flash');
    setTimeout(function(){ el.classList.remove('card-flash'); }, 1700);
  }
  function target(id){
    if(!id) return;
    var el = null; try{ el = document.getElementById(id); }catch(e){}
    if(el) flash(el);
  }
  window.addEventListener('message', function(e){
    var d = e.data;
    if(d && d.__lesson && d.type==='scrollToCard') target(String(d.id||''));
  });
  ${
    share
      ? `function txt(el){ return el ? (el.textContent||'').replace(/\\s+/g,' ').trim() : ''; }
  document.querySelectorAll('.term[id], .word[id]').forEach(function(card){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-share';
    btn.setAttribute('aria-label', 'Share this definition');
    btn.title = 'Share this definition';
    btn.textContent = '\\u2197'; // ↗ share-out glyph
    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      var term, def;
      if (card.classList.contains('term')) { term = txt(card.querySelector('.name')); def = txt(card.querySelector('.def')); }
      else { var tr = txt(card.querySelector('.tr')); term = txt(card.querySelector('.w')) + (tr ? ' ('+tr+')' : ''); def = txt(card.querySelector('.g')); }
      post({type:'shareCard', term: term, definition: def});
    });
    card.appendChild(btn);
  });`
      : ""
  }
}());<\/script>`;
}

// The card affordances' CSS (reference-cards/02+03). The ~1.7s fading highlight for
// a deep-linked card, and the hover-revealed per-card share button. Theme-aware via
// the reference palette vars (which REFERENCE_DARK_CSS flips in dark). Injected only
// for references. `.term`/`.word` are made positioning contexts so the share button
// anchors to the card corner without disturbing the `.word` grid.
const REFERENCE_CARD_CSS = `<style>
@keyframes cardflash{from{box-shadow:0 0 0 3px var(--gold); background:var(--hi)} to{box-shadow:0 0 0 3px transparent; background:transparent}}
.card-flash{animation:cardflash 1.7s ease-out; border-radius:10px; scroll-margin-top:16px}
.term, .word{position:relative}
.card-share{position:absolute; top:8px; right:8px; border:0; background:transparent; cursor:pointer;
  font-size:15px; line-height:1; padding:5px 7px; border-radius:7px; color:var(--soft);
  opacity:0; transition:opacity .15s, background .15s, color .15s}
.term:hover .card-share, .word:hover .card-share, .card-share:focus-visible{opacity:1}
.card-share:hover{background:var(--hi); color:var(--accent)}
@media (hover:none){.card-share{opacity:.55}}
</style>`;

function injectReferenceCardCss(html: string): string {
  const i = html.indexOf("</head>");
  return i === -1 ? REFERENCE_CARD_CSS + html : html.slice(0, i) + REFERENCE_CARD_CSS + html.slice(i);
}

// The message the parent posts to a reference iframe's REFERENCE_BRIDGE to scroll
// to and flash a card. `id` is the card's anchor id (the `#<cardId>` fragment).
export function scrollToCardMessage(id: string): { __lesson: true; type: "scrollToCard"; id: string } {
  return { __lesson: true, type: "scrollToCard", id };
}

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
const DEVANAGARI_CSS = `<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&display=block" rel="stylesheet">
<style>html{zoom:1.2;}
html body{font-family:'Spectral','Noto Serif Devanagari','Noto Sans Devanagari',Georgia,serif; line-height:1.75;}</style>`;

// Inject the Devanagari font + zoom before </head> so it applies before paint.
function injectDevanagariCss(html: string): string {
  const i = html.indexOf("</head>");
  return i === -1 ? DEVANAGARI_CSS + html : html.slice(0, i) + DEVANAGARI_CSS + html.slice(i);
}

// Quiz options are <button>s, and head.html's `.opt` rule sets `font:inherit` but
// no colour — so the label fell through to the UA's ButtonText, which renders as a
// dim grey under a dark colour-scheme (visibly fainter than the question above it).
// Fixed in head.html for newly authored lessons; this override carries the fix to
// the lessons ALREADY stored, whose HTML has the old rule baked in.
//
// `:not(.correct):not(.wrong)` so an answered option keeps the state colour
// head.html sets at `.opt.correct` — and it's what carries the specificity too:
// (0,3,0) already outranks the authored `.opt` (0,1,0), so this needs no `:root:root`
// doubling (which is reserved for the tenant palette blocks).
const LESSON_OPTION_INK_CSS = `<style>.opt:not(.correct):not(.wrong){color:var(--ink)}</style>`;

function injectLessonOptionInk(html: string): string {
  const i = html.indexOf("</head>");
  return i === -1 ? LESSON_OPTION_INK_CSS + html : html.slice(0, i) + LESSON_OPTION_INK_CSS + html.slice(i);
}

// Justified prose. Added to head.html for newly published lessons; this carries
// it to the lessons ALREADY stored, whose HTML has the old rule baked in
// (published lessons are immutable — ADR 0003). Above the mobile breakpoint
// only: at a phone's measure, justification opens rivers of whitespace between
// words, so narrow screens stay ragged-right. Paragraphs only — headings, the
// `.sub` deck and the pills are divs and stay as authored.
const LESSON_JUSTIFY_CSS = `<style>@media (min-width: 641px){.wrap p{text-align:justify; hyphens:auto}}</style>`;

function injectLessonJustify(html: string): string {
  const i = html.indexOf("</head>");
  return i === -1 ? LESSON_JUSTIFY_CSS + html : html.slice(0, i) + LESSON_JUSTIFY_CSS + html.slice(i);
}

// Re-point the lesson design system's HARDCODED dark surfaces at the palette
// tokens, for tenant hosts only. Every lesson's stored HTML carries head.html's
// dark block, which hardcodes ~20 warm-brown hexes (#241f1a cards, #3a322a
// borders, #221d16 quiz options…) chosen for the shipped warm skin. Overriding
// the 14 tokens re-skins everything that reads a var, but those literals don't —
// so a navy tenant's lesson came out navy-paper with brown cards, quiz options
// and callouts sitting on top of it. Mapping them to `var(--card)`/`var(--line)`
// makes them follow whatever palette is live.
//
// `:root:root[data-theme="dark"] <sel>` outranks head.html's
// `:root[data-theme="dark"] <sel>`, so this wins regardless of source order.
// Injected ONLY alongside a tenant palette: on the default site the authored
// warm values already agree with the palette, and leaving them untouched keeps
// the shipped skin exactly as designed.
//
// Deliberately NOT remapped: the grammar mark colours (mark.r/v/b green,
// mark.c/j blue) and .note.devo purple are semantic colour-coding, not surfaces —
// they carry meaning a reader learns, so they stay fixed across tenants.
const TENANT_LESSON_DARK_CSS = `
:root:root[data-theme="dark"] header.lesson, :root:root[data-theme="dark"] footer,
:root:root[data-theme="dark"] .verse, :root:root[data-theme="dark"] .quiz,
:root:root[data-theme="dark"] .grid2 .col, :root:root[data-theme="dark"] .word,
:root:root[data-theme="dark"] table.paradigm th, :root:root[data-theme="dark"] table.paradigm td,
:root:root[data-theme="dark"] .build .chip{border-color:var(--line)}
:root:root[data-theme="dark"] .grid2 .row{border-top-color:var(--line)}
:root:root[data-theme="dark"] .word{border-bottom-color:var(--line)}
:root:root[data-theme="dark"] .note, :root:root[data-theme="dark"] .recap,
:root:root[data-theme="dark"] .pill, :root:root[data-theme="dark"] .build .chip,
:root:root[data-theme="dark"] table.paradigm th{background:var(--card)}
/* Slightly recessed surfaces (quiz options, the parked-for-next-lesson card) and
   their lifted hover state, expressed as mixes of the live tokens. */
:root:root[data-theme="dark"] .park, :root:root[data-theme="dark"] .opt{background:color-mix(in oklab, var(--card) 85%, var(--paper))}
:root:root[data-theme="dark"] .opt:hover, :root:root[data-theme="dark"] .fill input{background:color-mix(in oklab, var(--card) 88%, var(--ink))}
/* Gold-ornamented edges (.park, .build .res) keep their hint of ornament, mixed
   from the tenant's own gold rather than the shipped #4a3d2a. */
:root:root[data-theme="dark"] .park, :root:root[data-theme="dark"] .build .res{border-color:color-mix(in oklab, var(--line) 70%, var(--gold))}
:root:root[data-theme="dark"] .win{background:linear-gradient(180deg,var(--card),color-mix(in oklab, var(--card) 88%, var(--gold))); border-color:color-mix(in oklab, var(--line) 70%, var(--gold))}
/* The singular/plural cells stay distinguishable, tinted from the two brand hues
   instead of the shipped warm/green pair. */
:root:root[data-theme="dark"] .grid2 .col.sg .ch{background:color-mix(in oklab, var(--card) 88%, var(--gold))}
:root:root[data-theme="dark"] .grid2 .col.pl .ch{background:color-mix(in oklab, var(--card) 88%, var(--accent2))}`;

// Inject the tenant's palette (issue 13 / decision 03 #6) before </head> so it
// applies before the artifact paints. Uses BARE var names (--paper, --accent…) —
// the lesson design system's namespace (head.html), not the app chrome's --color-*
// — via the shared token builder. Rides the same before-</head> rail as the
// dark/Devanagari injections, and is injected LAST so it sits closest to </head>
// (winning any source-order tie on top of its :root:root specificity). Moves only
// the 14 contract vars: head.html hardcodes dozens of hex beyond them, so legacy
// content is re-skinned partially by design — full fidelity is issue 23's job.
function injectTenantPaletteCss(html: string, palette: TenantTheme): string {
  const style = `<style>${buildTenantThemeCss(palette, "")}${TENANT_LESSON_DARK_CSS}</style>`;
  const i = html.indexOf("</head>");
  return i === -1 ? style + html : html.slice(0, i) + style + html.slice(i);
}

// Hide the green "ask your teacher" block when the Topic has Teacher Q&A off
// (teacher-qa/02). Published Lessons are immutable (ADR 0003) and the teach Routine
// keeps authoring the block unconditionally, so this is a render-time display rule
// rather than a rewrite: it needs no backfill, it reaches lessons authored while
// the setting was off, and flipping the setting back on restores the block on every
// lesson at once. Head-only, which is also what keeps the editor's body read-back
// on save free of it.
//
// head.html styles `.ask` at (0,1,0) and sets no `display`, so a bare `.ask` rule
// injected later in the head is enough; no specificity doubling is needed. The
// block's "Main source for this week's reading" citation is redundant with the
// <footer> Sources line directly below it, which carries the fuller attribution, so
// nothing is lost by hiding the whole block.
const ASK_HIDDEN_CSS = `<style>.ask{display:none}</style>`;

function injectAskHidden(html: string): string {
  const i = html.indexOf("</head>");
  return i === -1 ? ASK_HIDDEN_CSS + html : html.slice(0, i) + ASK_HIDDEN_CSS + html.slice(i);
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
  opts: {
    quiz: boolean;
    theme?: Theme;
    themeCss?: boolean;
    dir?: "ltr" | "rtl";
    lang?: string;
    // The resolved tenant's palette (issue 13), from the client tenant context.
    // Absent on the default site → no override, the authored palette stands.
    tenantPalette?: TenantTheme;
    // The Topic's Teacher Q&A setting (teacher-qa/01), already resolved to a boolean
    // by the bundle the reader loads (`content.reader.courseHeader`, or
    // `public.publicCourse` for a Guest). `false` hides the lesson's ask block;
    // `true` and absence both leave the document exactly as authored.
    teacherQa?: boolean;
    // References only (reference-cards/02): add the reference bridge + card CSS so a
    // lesson can deep-link to a single glossary card. The parent drives the scroll
    // via a `scrollToCard` postMessage, so the target isn't baked (no reload on a
    // same-reference card change).
    reference?: boolean;
    // References only (reference-cards/03): also inject the per-card share button.
    // Implies `reference`. Set only when the course has a public link to share.
    refShare?: boolean;
  },
): string {
  let doc = ensureDocument(html);
  if (opts.theme) {
    doc = stripLegacyThemePill(doc);
    doc = setRootTheme(doc, opts.theme);
    if (opts.themeCss) doc = injectReferenceDarkCss(doc);
  }
  const reference = opts.reference || opts.refShare;
  if (reference) doc = injectReferenceCardCss(doc);
  // Lessons only — `quiz` is what distinguishes a lesson from a reference here, and
  // references carry no quiz options.
  if (opts.quiz) {
    doc = injectLessonOptionInk(doc);
    doc = injectLessonJustify(doc);
  }
  if (opts.teacherQa === false) doc = injectAskHidden(doc);
  doc = setRootDirLang(doc, opts.dir, opts.lang);
  if (opts.lang && isDevanagari(opts.lang)) doc = injectDevanagariCss(doc);
  if (opts.tenantPalette) doc = injectTenantPaletteCss(doc, opts.tenantPalette);
  const scripts =
    HEIGHT_BRIDGE +
    NAV_BRIDGE +
    (opts.quiz ? QUIZ_BRIDGE : "") +
    (opts.theme ? THEME_BRIDGE : "") +
    (reference ? referenceBridge(!!opts.refShare) : "");
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
export function buildEditDoc(
  html: string,
  // `teacherQa` mirrors buildSrcDoc's: the owner edits what a learner sees, so a
  // course with the setting off shows no ask block in the in-place editor either.
  opts: { theme?: Theme; themeCss?: boolean; dir?: "ltr" | "rtl"; lang?: string; teacherQa?: boolean } = {},
): string {
  let doc = ensureDocument(html);
  if (opts.theme) {
    doc = stripLegacyThemePill(doc);
    doc = setRootTheme(doc, opts.theme);
    // References carry no dark palette of their own, so inject it for the editor
    // just like the reader's Frame does (ADR 0011). Head-only, so the body
    // read-back on save is unaffected.
    if (opts.themeCss) doc = injectReferenceDarkCss(doc);
  }
  // Stamp the served Edition's direction/language so a translated Lesson edits
  // RTL/localised (course-translation), matching the reader's Frame. Applied to
  // the <html> tag + head, so the body read-back is unaffected.
  doc = setRootDirLang(doc, opts.dir, opts.lang);
  if (opts.lang && isDevanagari(opts.lang)) doc = injectDevanagariCss(doc);
  if (opts.teacherQa === false) doc = injectAskHidden(doc);
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

// Splice a new display title into the stored document's head `<title>`,
// preserving the `Lesson N · ` / `Reference · ` prefix that the publish path
// parses back out (`titleFrom`, convex/authoring.ts). The in-editor rename
// (editing-obviousness unit 4) writes the name to two places in one save: the
// row's `title` column, which is what the reader renders, and this tag, which
// keeps the stored document self-describing when it is read on its own. A string
// splice for the same reason replaceBodyInner is one (the rest of the document
// round-trips byte-for-byte), and head-only, so it composes with the body splice
// without touching what the editor read back. A document with no <title> is
// returned unchanged: the column is the authority, so a missing tag is cosmetic.
export function replaceTitleDisplay(html: string, display: string): string {
  const escaped = display.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // A callback replacement, so a `$&` inside a typed title is inert.
  return html.replace(/<title>([\s\S]*?)<\/title>/i, (_m, raw: string) => {
    // Only the FIRST " · " is a prefix boundary: `titleFrom` joins everything
    // after it back together, so a subtitle may carry its own separator.
    const sep = raw.indexOf(" · ");
    const prefix = sep === -1 ? "" : raw.slice(0, sep + 3);
    return `<title>${prefix}${escaped}</title>`;
  });
}
