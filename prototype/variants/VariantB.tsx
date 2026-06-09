import { useState } from "react";
import type { PrototypeApp } from "../store";
import { AskBox, LessonBody, progressMeta, QuizBlock } from "../parts";

// Variant B — "Workstation": three panes. Left = nav (lessons + references),
// center = the lesson, right = the question/reply thread, always visible. The
// persistent thread rail is the defining affordance.
export const name = "Workstation";

export function VariantB({ app }: { app: PrototypeApp }) {
  const [refId, setRefId] = useState<string | null>(null);
  const lesson = app.currentLessonId ? app.lessonOf(app.currentLessonId) : undefined;
  const ref = refId ? app.references.find((r) => r.id === refId) : undefined;

  const pickLesson = (id: string) => {
    setRefId(null);
    app.openLesson(id);
  };

  return (
    <div className="vB">
      <aside className="vB-side">
        <div className="vB-topic">{app.topic.title}</div>
        <p className="vB-mission">{app.topic.mission}</p>

        <div className="vB-section-label">Lessons</div>
        <ul className="vB-nav">
          {app.lessons.map((l) => {
            const m = progressMeta[app.progress[l.id] ?? "unseen"];
            const active = !ref && app.currentLessonId === l.id;
            return (
              <li key={l.id}>
                <button className={`vB-navitem ${active ? "active" : ""}`} onClick={() => pickLesson(l.id)}>
                  <span className="vB-dot" style={{ color: m.color }}>
                    {m.dot}
                  </span>
                  <span className="vB-navtitle">{l.title}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="vB-section-label">References</div>
        <ul className="vB-nav">
          {app.references.map((r) => (
            <li key={r.id}>
              <button className={`vB-navitem ${ref?.id === r.id ? "active" : ""}`} onClick={() => setRefId(r.id)}>
                <span className="vB-dot">▤</span>
                <span className="vB-navtitle">{r.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="vB-main">
        {ref ? (
          <article className="vB-doc">
            <div className="vB-kicker">Reference · always current</div>
            <h1>{ref.title}</h1>
            <LessonBody html={ref.bodyHtml} />
          </article>
        ) : lesson ? (
          <article className="vB-doc">
            <div className="vB-kicker">
              Lesson {String(lesson.order).padStart(2, "0")} ·{" "}
              {progressMeta[app.progress[lesson.id] ?? "unseen"].label}
            </div>
            <h1>{lesson.title}</h1>
            <LessonBody html={lesson.bodyHtml} />
            <QuizBlock lesson={lesson} app={app} />
          </article>
        ) : (
          <div className="vB-empty">
            <h1>{app.topic.title}</h1>
            <p>{app.topic.mission}</p>
            <p className="muted">Pick a lesson on the left to begin.</p>
          </div>
        )}
      </main>

      <aside className="vB-rail">
        <div className="vB-rail-head">
          Conversation
          {app.openQuestionCount > 0 && <span className="pill pill-amber">{app.openQuestionCount} open</span>}
        </div>
        <div className="vB-rail-scroll">
          {app.questions.map((q) => {
            const answered = q.reply !== undefined;
            return (
              <div key={q.id} className={`rail-msg ${answered ? "answered" : "open"}`}>
                <div className="rail-q">{q.text}</div>
                {answered ? (
                  <div className="rail-reply">{q.reply}</div>
                ) : (
                  <div className="rail-waiting">⏳ waiting for next session</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="vB-rail-ask">
          <AskBox lessonId={lesson?.id ?? app.lessons[0]!.id} app={app} compact />
        </div>
      </aside>
    </div>
  );
}
