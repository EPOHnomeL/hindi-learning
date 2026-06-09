import type { PrototypeApp } from "../store";
import { AskBox, LessonBody, progressMeta, QuizBlock } from "../parts";

// Variant C — "Pocket Deck": phone-shaped, card-based, app-like. Lessons are a
// deck of big cards with progress rings; a lesson opens as a full sheet; a
// bottom tab bar switches Lessons / Thread; an Ask FAB on the lesson sheet.
export const name = "Pocket Deck";

export function VariantC({ app }: { app: PrototypeApp }) {
  const lesson = app.view === "lesson" && app.currentLessonId ? app.lessonOf(app.currentLessonId) : undefined;
  const done = app.lessons.filter((l) => (app.progress[l.id] ?? "unseen") === "completed").length;

  return (
    <div className="vC-stage">
      <div className="vC-phone">
        {lesson ? (
          <div className="vC-sheet">
            <div className="vC-sheet-top">
              <button className="vC-close" onClick={app.goTopic}>
                ✕
              </button>
              <span className="vC-sheet-kicker">
                Lesson {String(lesson.order).padStart(2, "0")}
              </span>
            </div>
            <div className="vC-scroll">
              <h1 className="vC-h1">{lesson.title}</h1>
              <LessonBody html={lesson.bodyHtml} />
              <QuizBlock lesson={lesson} app={app} />
              <div id="vC-ask">
                <AskBox lessonId={lesson.id} app={app} compact />
              </div>
            </div>
            <a className="vC-fab" href="#vC-ask">
              🙋
            </a>
          </div>
        ) : app.view === "thread" ? (
          <div className="vC-scroll">
            <h2 className="vC-tabtitle">Conversation</h2>
            <div className="vC-chat">
              {app.questions.map((q) => {
                const answered = q.reply !== undefined;
                return (
                  <div key={q.id} className="vC-exchange">
                    <div className="vC-bubble vC-you">{q.text}</div>
                    {answered ? (
                      <div className="vC-bubble vC-teacher">{q.reply}</div>
                    ) : (
                      <div className="vC-bubble vC-pending">⏳ open — answered next session</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="vC-scroll">
            <div className="vC-hero">
              <div className="vC-hero-title">{app.topic.title}</div>
              <p className="vC-hero-mission">{app.topic.mission}</p>
              <div className="vC-streak">
                {done}/{app.lessons.length} lessons complete
              </div>
            </div>
            <div className="vC-deck">
              {app.lessons.map((l) => {
                const state = app.progress[l.id] ?? "unseen";
                const m = progressMeta[state];
                return (
                  <button key={l.id} className={`vC-card ${state}`} onClick={() => app.openLesson(l.id)}>
                    <div className="vC-ring" style={{ borderColor: m.color, color: m.color }}>
                      {m.dot}
                    </div>
                    <div className="vC-card-body">
                      <div className="vC-card-title">{l.title}</div>
                      <div className="vC-card-sub">{l.oneLiner}</div>
                      <div className="vC-card-state" style={{ color: m.color }}>
                        {m.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="vC-refstrip">
              {app.references.map((r) => (
                <div key={r.id} className="vC-chip">
                  ▤ {r.title}
                </div>
              ))}
            </div>
          </div>
        )}

        <nav className="vC-tabs">
          <button className={`vC-tab ${app.view !== "thread" ? "active" : ""}`} onClick={app.goTopic}>
            📚<span>Lessons</span>
          </button>
          <button className={`vC-tab ${app.view === "thread" ? "active" : ""}`} onClick={app.goThread}>
            💬<span>Thread{app.openQuestionCount > 0 ? ` ·${app.openQuestionCount}` : ""}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
