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

// Bake the selected theme onto the root <html> so the lesson renders in the
// right palette with no flash.
function setRootTheme(html: string, theme: Theme): string {
  return html.replace(/<html\b([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s+data-theme=(["']).*?\1/i, "");
    return `<html${cleaned} data-theme="${theme}">`;
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
// (unlike lessons) don't bundle their own dark CSS. ADR 0011.
export function buildSrcDoc(html: string, opts: { quiz: boolean; theme?: Theme; themeCss?: boolean }): string {
  let doc = html;
  if (opts.theme) {
    doc = stripLegacyThemePill(doc);
    doc = setRootTheme(doc, opts.theme);
    if (opts.themeCss) doc = injectReferenceDarkCss(doc);
  }
  const scripts = HEIGHT_BRIDGE + NAV_BRIDGE + (opts.quiz ? QUIZ_BRIDGE : "") + (opts.theme ? THEME_BRIDGE : "");
  // Inject before the LAST </body>. A first-match replace is unsafe: an assembled
  // lesson can carry an authoring comment (or a code sample) that contains a
  // literal "</body>" earlier in the document, and injecting there would bury the
  // bridge scripts inside it — inert, so the iframe never reports its height (ask
  // box overlaps) and quiz answers aren't captured.
  const i = doc.lastIndexOf("</body>");
  return i === -1 ? doc + scripts : doc.slice(0, i) + scripts + doc.slice(i);
}
