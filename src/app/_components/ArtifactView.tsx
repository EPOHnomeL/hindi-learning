"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";

// Injected into a lesson's iframe. It reads the AUTHORED quiz markup
// (.quiz[data-correct] + .opt[data-k], and .quiz.fill[data-answer]) and posts
// the learner's answer to the parent — so lessons stay self-contained with no
// API calls of their own (the teach convention). First-answer-only is enforced
// server-side, so re-clicks are harmless.
const CAPTURE_BRIDGE = `<script>(function(){
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

export function ArtifactView({ kind, artifactKey }: { kind: "lesson" | "reference"; artifactKey: string }) {
  if (kind === "reference") return <ReferenceView refKey={artifactKey} />;
  return <LessonView lessonKey={artifactKey} />;
}

// Fills its flex parent; min height keeps it usable when the column is short
// (e.g. stacked on mobile).
function Frame({ html, withBridge }: { html: string; withBridge: boolean }) {
  const srcDoc = useMemo(() => {
    if (!withBridge) return html;
    return html.includes("</body>") ? html.replace("</body>", CAPTURE_BRIDGE + "</body>") : html + CAPTURE_BRIDGE;
  }, [html, withBridge]);
  return <iframe sandbox="allow-scripts" srcDoc={srcDoc} className="min-h-[60vh] w-full flex-1 rounded-xl border border-line bg-card" />;
}

function LessonView({ lessonKey }: { lessonKey: string }) {
  const lesson = useQuery(api.content.getLesson, { key: lessonKey });
  const progress = useQuery(api.capture.myProgress);
  const recordResponse = useMutation(api.capture.recordResponse);
  const setProgress = useMutation(api.capture.setProgress);

  const completed = (progress ?? []).some((p) => p.lessonKey === lessonKey && p.status === "completed");

  useEffect(() => {
    if (lesson) void setProgress({ lessonKey, status: "opened" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.key]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { __lesson?: boolean; type?: string; quizId?: string; answer?: unknown; correct?: unknown };
      if (!d?.__lesson || d.type !== "response" || !d.quizId) return;
      void recordResponse({ lessonKey, quizId: d.quizId, answer: String(d.answer ?? ""), correct: Boolean(d.correct) });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [lessonKey, recordResponse]);

  if (lesson === undefined) return <p className="text-soft">Loading…</p>;
  if (lesson === null) return <p className="text-soft">Lesson not found.</p>;

  return (
    <div className="flex h-full flex-col gap-4 md:flex-row">
      {/* Lesson column — fills the available height. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{lesson.title}</h2>
          <button
            onClick={() => void setProgress({ lessonKey, status: "completed" })}
            disabled={completed}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              completed
                ? "cursor-default border-accent2 bg-accent2 text-white"
                : "border-accent text-accent hover:bg-hi"
            }`}
          >
            {completed ? "✓ Completed" : "Mark complete"}
          </button>
        </div>
        <Frame html={lesson.html} withBridge />
      </div>
      {/* Ask column — right-hand side on desktop, stacks below on mobile. */}
      <aside className="shrink-0 md:w-80 md:overflow-y-auto">
        <QuestionBox lessonKey={lessonKey} />
      </aside>
    </div>
  );
}

function ReferenceView({ refKey }: { refKey: string }) {
  const ref = useQuery(api.content.getReference, { key: refKey });
  if (ref === undefined) return <p className="text-soft">Loading…</p>;
  if (ref === null) return <p className="text-soft">Reference not found.</p>;
  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="text-lg font-semibold">{ref.title}</h2>
      <Frame html={ref.html} withBridge={false} />
    </div>
  );
}

// Ask the teacher a question and see the reply inline once answered (live).
function QuestionBox({ lessonKey }: { lessonKey: string }) {
  const questions = useQuery(api.capture.myQuestions);
  const askQuestion = useMutation(api.capture.askQuestion);
  const [text, setText] = useState("");
  const mine = questions?.filter((q) => q.lessonKey === lessonKey) ?? [];

  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-card p-4">
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
      <ul className="mt-3 flex flex-col gap-3 overflow-y-auto">
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
