import { useState } from "react";
import type { PrototypeApp } from "./store";
import type { Lesson, ProgressState } from "./mock";

export const progressMeta: Record<ProgressState, { label: string; dot: string; color: string }> = {
  unseen: { label: "Not started", dot: "○", color: "#9aa0a6" },
  opened: { label: "In progress", dot: "◐", color: "#e8a33d" },
  completed: { label: "Completed", dot: "●", color: "#3a9d6b" },
};

/** Renders the self-contained lesson body (the teach HTML blob). */
export function LessonBody({ html }: { html: string }) {
  return <div className="lesson-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Inline quiz prompt that captures a Response and gives immediate feedback. */
export function QuizBlock({ lesson, app }: { lesson: Lesson; app: PrototypeApp }) {
  const [picked, setPicked] = useState<string | null>(null);
  const answered = picked !== null;
  const correct = picked === lesson.quiz.correct;

  const choose = (key: string) => {
    if (answered) return;
    setPicked(key);
    app.submitResponse(lesson.id, lesson.quiz.promptId, key, key === lesson.quiz.correct);
  };

  return (
    <div className="quiz">
      <div className="quiz-q">{lesson.quiz.question}</div>
      <div className="quiz-options">
        {lesson.quiz.options.map((o) => {
          const state = !answered
            ? ""
            : o.key === lesson.quiz.correct
              ? "right"
              : o.key === picked
                ? "wrong"
                : "dim";
          return (
            <button key={o.key} className={`quiz-opt ${state}`} onClick={() => choose(o.key)} disabled={answered}>
              <span className="quiz-key">{o.key}</span> {o.label}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`quiz-feedback ${correct ? "right" : "wrong"}`}>
          {correct ? "✓ Correct. " : "✗ Not quite. "}
          {lesson.quiz.explain}
          {" "}
          <button className="link" onClick={() => app.completeLesson(lesson.id)}>
            Mark lesson complete →
          </button>
        </div>
      )}
    </div>
  );
}

/** Always-available "ask my teacher" box that captures a Question. */
export function AskBox({ lessonId, app, compact }: { lessonId: string; app: PrototypeApp; compact?: boolean }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const send = () => {
    if (text.trim() === "") return;
    app.askQuestion(lessonId, text.trim());
    setText("");
    setSent(true);
    setTimeout(() => setSent(false), 2200);
  };

  return (
    <div className={`askbox ${compact ? "compact" : ""}`}>
      <label className="askbox-label">🙋 Ask your teacher</label>
      <textarea
        value={text}
        placeholder="Stuck on something? Ask here — Claude Code answers next session."
        onChange={(e) => setText(e.target.value)}
        rows={compact ? 2 : 3}
      />
      <div className="askbox-row">
        <button className="btn" onClick={send} disabled={text.trim() === ""}>
          Send question
        </button>
        {sent && <span className="askbox-sent">Sent — it'll show as “open” in your thread.</span>}
      </div>
    </div>
  );
}
