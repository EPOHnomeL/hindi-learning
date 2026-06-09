import type { PrototypeApp } from "../store";
import { AskBox, LessonBody, progressMeta, QuizBlock } from "../parts";

// Variant A — "Quiet Reader": one narrow centered column, distraction-free,
// reads like a study Bible. Navigation is a plain vertical list.
export const name = "Quiet Reader";

export function VariantA({ app }: { app: PrototypeApp }) {
  const lesson = app.currentLessonId ? app.lessonOf(app.currentLessonId) : undefined;

  return (
    <div className="vA">
      <header className="vA-top">
        <button className="vA-brand" onClick={app.goTopic}>
          {app.topic.title}
        </button>
        <button className="link" onClick={app.goThread}>
          Questions {app.openQuestionCount > 0 ? `(${app.openQuestionCount} open)` : ""}
        </button>
      </header>

      <main className="vA-column">
        {app.view === "topic" && (
          <>
            <p className="vA-mission">{app.topic.mission}</p>
            <ol className="vA-lessons">
              {app.lessons.map((l) => {
                const m = progressMeta[app.progress[l.id] ?? "unseen"];
                return (
                  <li key={l.id}>
                    <button className="vA-lesson" onClick={() => app.openLesson(l.id)}>
                      <span className="vA-num">{String(l.order).padStart(2, "0")}</span>
                      <span className="vA-lesson-main">
                        <span className="vA-lesson-title">{l.title}</span>
                        <span className="vA-lesson-sub">{l.oneLiner}</span>
                      </span>
                      <span className="vA-prog" style={{ color: m.color }}>
                        {m.dot} {m.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <h4 className="vA-refhead">Keep handy</h4>
            <ul className="vA-refs">
              {app.references.map((r) => (
                <li key={r.id}>
                  <span className="vA-ref-title">{r.title}</span>
                  <span className="vA-ref-blurb">{r.blurb}</span>
                  <div className="lesson-body small" dangerouslySetInnerHTML={{ __html: r.bodyHtml }} />
                </li>
              ))}
            </ul>
          </>
        )}

        {app.view === "lesson" && lesson && (
          <article className="vA-article">
            <button className="link back" onClick={app.goTopic}>
              ← All lessons
            </button>
            <h1 className="vA-h1">{lesson.title}</h1>
            <LessonBody html={lesson.bodyHtml} />
            <QuizBlock lesson={lesson} app={app} />
            <AskBox lessonId={lesson.id} app={app} />
          </article>
        )}

        {app.view === "thread" && (
          <section className="vA-thread">
            <button className="link back" onClick={app.goTopic}>
              ← All lessons
            </button>
            <h1 className="vA-h1">Your questions</h1>
            <Thread app={app} />
          </section>
        )}
      </main>
    </div>
  );
}

function Thread({ app }: { app: PrototypeApp }) {
  return (
    <ul className="thread-list">
      {app.questions.map((q) => {
        const l = app.lessonOf(q.lessonId);
        const answered = q.reply !== undefined;
        return (
          <li key={q.id} className={`thread-item ${answered ? "answered" : "open"}`}>
            <div className="thread-meta">
              <span className={`pill ${answered ? "pill-green" : "pill-amber"}`}>
                {answered ? "answered" : "open"}
              </span>
              <span className="thread-lesson">{l?.title}</span>
            </div>
            <p className="thread-q">{q.text}</p>
            {answered && <p className="thread-reply">{q.reply}</p>}
          </li>
        );
      })}
    </ul>
  );
}
