"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

// Mirror of the server's stale threshold (convex/routine.ts STALE_MS): a run
// stuck "generating" past this is treated as crashed and offered for retry.
const STALE_MS = 10 * 60 * 1000;

// Injected into the iframe. Two concerns, kept separate:
//  - HEIGHT_BRIDGE (always): posts the document's content height so the parent
//    can size the iframe to fit. On mobile that makes the whole PAGE the single
//    scroll surface (no nested iframe scroll), so the browser chrome is free to
//    collapse and the lesson gets the full screen.
//  - QUIZ_BRIDGE (lessons only): reads the AUTHORED quiz markup (.quiz[data-correct]
//    + .opt[data-k], and .quiz.fill[data-answer]) and posts the learner's answer,
//    so lessons stay self-contained with no API calls of their own. First-answer-
//    only is enforced server-side, so re-clicks are harmless.
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

export function ArtifactView({
  kind,
  artifactKey,
  topicSlug,
  isFrontier,
}: {
  kind: "lesson" | "reference";
  artifactKey: string;
  topicSlug: string;
  isFrontier: boolean;
}) {
  if (kind === "reference") return <ReferenceView refKey={artifactKey} />;
  return <LessonView lessonKey={artifactKey} topicSlug={topicSlug} isFrontier={isFrontier} />;
}

// Fills its flex parent; min height keeps it usable when the column is short
// (e.g. stacked on mobile).
function Frame({ html, withBridge }: { html: string; withBridge: boolean }) {
  const srcDoc = useMemo(() => {
    const scripts = HEIGHT_BRIDGE + (withBridge ? QUIZ_BRIDGE : "");
    return html.includes("</body>") ? html.replace("</body>", scripts + "</body>") : html + scripts;
  }, [html, withBridge]);

  // On mobile the iframe is sized to its content so the whole page scrolls as one
  // surface; on desktop it fills its column and scrolls internally. The measured
  // height is ignored above md (the style is only applied while `mobile`).
  const [mobile, setMobile] = useState(false);
  const [contentH, setContentH] = useState<number | null>(null);
  useEffect(() => setContentH(null), [srcDoc]);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data as { __lesson?: boolean; type?: string; height?: unknown };
      if (d?.__lesson && d.type === "height" && typeof d.height === "number") setContentH(d.height);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Full-bleed on mobile (edge-to-edge, no side border/rounding); a bordered card
  // that fills and scrolls internally on desktop.
  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={mobile && contentH ? { height: contentH } : undefined}
      className={`w-full border-y border-line bg-card md:min-h-[60vh] md:flex-1 md:rounded-xl md:border ${contentH ? "" : "min-h-[60vh]"}`}
    />
  );
}

function LessonView({ lessonKey, topicSlug, isFrontier }: { lessonKey: string; topicSlug: string; isFrontier: boolean }) {
  const lesson = useQuery(api.content.getLesson, { key: lessonKey });
  const progress = useQuery(api.capture.myProgress);
  const recordResponse = useMutation(api.capture.recordResponse);
  const setProgress = useMutation(api.capture.setProgress);

  const completed = (progress ?? []).some((p) => p.lessonKey === lessonKey && p.status === "completed");

  // On mobile the ask box stays hidden until the learner scrolls to the bottom of
  // the page (the lesson now scrolls the whole page, not a nested iframe). A body
  // ResizeObserver re-checks once the iframe finishes sizing to its content.
  const [atBottom, setAtBottom] = useState(false);
  useEffect(() => {
    setAtBottom(false);
    function check() {
      const el = document.scrollingElement ?? document.documentElement;
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 64);
    }
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(document.body);
    check();
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      ro?.disconnect();
    };
  }, [lessonKey]);

  useEffect(() => {
    if (lesson) void setProgress({ lessonKey, status: "opened" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.key]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { __lesson?: boolean; type?: string; quizId?: string; answer?: unknown; correct?: unknown };
      if (d?.__lesson && d.type === "response" && d.quizId) {
        void recordResponse({ lessonKey, quizId: d.quizId, answer: String(d.answer ?? ""), correct: Boolean(d.correct) });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [lessonKey, recordResponse]);

  if (lesson === undefined) return <p className="text-soft">Loading…</p>;
  if (lesson === null) return <p className="text-soft">Lesson not found.</p>;

  return (
    <div className="flex flex-col gap-4 md:h-full md:flex-row">
      {/* Lesson column — fills the available height on desktop; grows with content on mobile. */}
      <div className="flex min-h-0 flex-1 flex-col gap-0 md:gap-3">
        {/* Title + actions: a sticky bar under the mobile header; inline on desktop. */}
        <div className="sticky top-12 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper px-3 py-2 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0">
          <h2 className="min-w-0 truncate text-lg font-semibold">{lesson.title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {isFrontier && completed && <NextLessonButton topicSlug={topicSlug} frontierKey={lessonKey} />}
            <button
              onClick={() => void setProgress({ lessonKey, status: "completed" })}
              disabled={completed}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                completed
                  ? "cursor-default border-accent2 bg-accent2 text-white"
                  : "border-accent text-accent hover:bg-hi"
              }`}
            >
              {completed ? "✓ Completed" : "Mark complete"}
            </button>
          </div>
        </div>
        <Frame html={lesson.html} withBridge />
      </div>
      {/* Desktop: persistent ask column on the right. */}
      <aside className="hidden shrink-0 md:block md:w-80 md:overflow-y-auto">
        <QuestionBox lessonKey={lessonKey} />
      </aside>
      {/* Mobile: ask slides up from the bottom once the lesson is read through. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 px-3 pb-3 transition-transform duration-300 md:hidden ${
          atBottom ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <QuestionBox lessonKey={lessonKey} variant="sheet" />
      </div>
    </div>
  );
}

// Fires the next-lesson Routine on demand (ADR 0008). Only rendered on the
// completed Frontier. It reflects the lock so a press can't double-fire and a
// crashed run eventually offers a retry; the new lesson arrives live (Convex
// subscription), at which point this lesson is no longer the Frontier and the
// button unmounts.
function NextLessonButton({ topicSlug, frontierKey }: { topicSlug: string; frontierKey: string }) {
  const gen = useQuery(api.routine.generationStatus, { topicSlug });
  const requestNext = useAction(api.routine.requestNextLesson);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const status = gen?.status ?? "idle";
  const generating = status === "generating";

  // Tick while generating so a crashed run crosses the stale threshold in the UI.
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, [generating]);

  const stale = generating && gen?.startedAt != null && now - gen.startedAt > STALE_MS;
  const caughtUp = status === "caughtUp" && gen?.frontierKey === frontierKey;

  async function fire() {
    setPending(true);
    try {
      await requestNext({ topicSlug });
    } finally {
      setPending(false);
    }
  }

  if (generating && !stale) {
    return <span className="animate-pulse text-sm text-soft">Generating next lesson…</span>;
  }
  if (caughtUp) {
    return (
      <span className="text-sm text-accent2" title="Your teacher has nothing new queued yet.">
        ✨ All caught up
      </span>
    );
  }

  const label = status === "failed" ? "Retry" : stale ? "Still working — retry" : "Generate next lesson →";
  return (
    <div className="flex items-center gap-2">
      {status === "failed" && gen?.error && (
        <span title={gen.error} className="text-xs text-soft">
          generation failed
        </span>
      )}
      <button
        onClick={() => void fire()}
        disabled={pending}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {pending ? "Starting…" : label}
      </button>
    </div>
  );
}

function ReferenceView({ refKey }: { refKey: string }) {
  const ref = useQuery(api.content.getReference, { key: refKey });
  if (ref === undefined) return <p className="text-soft">Loading…</p>;
  if (ref === null) return <p className="text-soft">Reference not found.</p>;
  return (
    <div className="flex flex-col gap-0 md:h-full md:gap-3">
      <h2 className="sticky top-12 z-20 truncate border-b border-line bg-paper px-3 py-2 text-lg font-semibold md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0">{ref.title}</h2>
      <Frame html={ref.html} withBridge={false} />
    </div>
  );
}

// Ask the teacher a question and see the reply inline once answered (live).
// `panel` is the desktop side column; `sheet` is the mobile slide-up surface.
function QuestionBox({ lessonKey, variant = "panel" }: { lessonKey: string; variant?: "panel" | "sheet" }) {
  const questions = useQuery(api.capture.myQuestions);
  const askQuestion = useMutation(api.capture.askQuestion);
  const [text, setText] = useState("");
  const mine = questions?.filter((q) => q.lessonKey === lessonKey) ?? [];

  return (
    <div
      className={
        variant === "sheet"
          ? "flex max-h-[60dvh] flex-col rounded-t-2xl border border-line bg-card p-4 shadow-2xl"
          : "flex h-full flex-col rounded-xl border border-line bg-card p-4"
      }
    >
      {variant === "sheet" && <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-line" />}
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent2">Ask about this lesson</h3>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setText("");
          await askQuestion({ lessonKey, text: t });
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Your question…" className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none" />
        <button type="submit" className="rounded-lg bg-accent2 px-3 py-2 text-sm text-white hover:bg-accent2/90">Ask</button>
      </form>
      <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {mine.map((q) => (
          <li key={q.id} className="text-sm">
            <p className="text-ink">{q.text}</p>
            {q.reply ? (
              <p className="mt-1 rounded-lg bg-hi px-3 py-2 text-ink">{q.reply}</p>
            ) : (
              <p className="mt-1 text-xs text-soft">Waiting for your teacher…</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
