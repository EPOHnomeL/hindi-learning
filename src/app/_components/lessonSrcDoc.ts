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
  document.querySelectorAll('.quiz.fill[data-answer]').forEach(function(quiz,i){
    var id = quiz.id || ('fill-'+i);
    var answer = (quiz.getAttribute('data-answer')||'').trim().toLowerCase();
    var input = quiz.querySelector('input');
    var btn = quiz.querySelector('[data-check]') || quiz.querySelector('button');
    if(btn && input) btn.addEventListener('click', function(){
      var v=(input.value||'').trim().toLowerCase();
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

// The message the parent posts to an iframe's THEME_BRIDGE to re-skin it live.
export function themeMessage(theme: Theme): { __lessonTheme: true; theme: Theme } {
  return { __lessonTheme: true, theme };
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
// `quiz` adds the answer-capture bridge (lessons, not references). `theme`, when
// given, makes the artifact app-themed: the legacy pill is stripped, the initial
// theme is baked in, and the theme bridge is added so the parent can flip it live.
// References pass no theme and stay on their authored (light) styling — ADR 0011.
export function buildSrcDoc(html: string, opts: { quiz: boolean; theme?: Theme }): string {
  let doc = html;
  if (opts.theme) {
    doc = stripLegacyThemePill(doc);
    doc = setRootTheme(doc, opts.theme);
  }
  const scripts = HEIGHT_BRIDGE + (opts.quiz ? QUIZ_BRIDGE : "") + (opts.theme ? THEME_BRIDGE : "");
  // Inject before the LAST </body>. A first-match replace is unsafe: an assembled
  // lesson can carry an authoring comment (or a code sample) that contains a
  // literal "</body>" earlier in the document, and injecting there would bury the
  // bridge scripts inside it — inert, so the iframe never reports its height (ask
  // box overlaps) and quiz answers aren't captured.
  const i = doc.lastIndexOf("</body>");
  return i === -1 ? doc + scripts : doc.slice(0, i) + scripts + doc.slice(i);
}
