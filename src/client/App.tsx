import { useEffect, useState } from "react";
import {
  api,
  type Lesson,
  type ProgressState,
  type Question,
  type Reference,
  type Topic,
} from "./api";

type Selection = { kind: "lesson" | "reference"; id: string; title: string };
type Pane = "nav" | "read" | "thread";

const PROGRESS: Record<ProgressState, { dot: string; color: string; label: string }> = {
  unseen: { dot: "○", color: "#9aa0a6", label: "Not started" },
  opened: { dot: "◐", color: "#e8a33d", label: "In progress" },
  completed: { dot: "●", color: "#3a9d6b", label: "Done" },
};

export function App() {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressState>>({});
  const [selection, setSelection] = useState<Selection | null>(null);
  const [html, setHtml] = useState<string>("");
  const [pane, setPane] = useState<Pane>("nav");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const topics = await api.topics();
        const t = topics[0] ?? null;
        setTopic(t);
        if (t) {
          const [ls, rs, qs] = await Promise.all([
            api.lessons(t.id),
            api.references(t.id),
            api.openQuestions(t.id),
          ]);
          setLessons(ls);
          setReferences(rs);
          setQuestions(qs);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const bump = (lessonId: string, state: ProgressState) => {
    setProgress((p) => ({ ...p, [lessonId]: state }));
    void api.progress(lessonId, state);
  };

  const openLesson = async (l: Lesson) => {
    setSelection({ kind: "lesson", id: l.id, title: l.title });
    setPane("read");
    setHtml("");
    bump(l.id, "opened");
    try {
      setHtml(await api.lessonHtml(l.id));
    } catch {
      setHtml("<p style='padding:2rem;font-family:sans-serif'>Lesson content not published yet.</p>");
    }
  };

  const openReference = async (r: Reference) => {
    setSelection({ kind: "reference", id: r.id, title: r.title });
    setPane("read");
    setHtml("");
    try {
      setHtml(await api.referenceHtml(r.id));
    } catch {
      setHtml("<p style='padding:2rem;font-family:sans-serif'>Reference content not published yet.</p>");
    }
  };

  if (loading) return <div className="center muted">Loading…</div>;
  if (error) return <div className="center error">Couldn’t reach the API: {error}</div>;
  if (!topic) {
    return (
      <div className="center muted">
        No topics yet. Publish one from Claude Code, then refresh.
      </div>
    );
  }

  return (
    <div className="app" data-pane={pane}>
      <header className="topbar">
        <div className="topbar-title">{topic.title}</div>
        <div className="topbar-tabs">
          <button className={pane === "nav" ? "on" : ""} onClick={() => setPane("nav")}>Lessons</button>
          <button className={pane === "read" ? "on" : ""} onClick={() => setPane("read")} disabled={!selection}>Read</button>
          <button className={pane === "thread" ? "on" : ""} onClick={() => setPane("thread")}>
            Questions{questions.length ? ` ·${questions.length}` : ""}
          </button>
        </div>
      </header>

      <div className="grid">
        <aside className="nav pane-nav">
          <p className="mission">{topic.mission}</p>
          <div className="section">Lessons</div>
          <ul className="list">
            {lessons.map((l) => {
              const m = PROGRESS[progress[l.id] ?? "unseen"];
              return (
                <li key={l.id}>
                  <button
                    className={selection?.id === l.id ? "item active" : "item"}
                    onClick={() => openLesson(l)}
                  >
                    <span className="dot" style={{ color: m.color }}>{m.dot}</span>
                    <span className="item-title">{String(l.order).padStart(2, "0")} · {l.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="section">References</div>
          <ul className="list">
            {references.map((r) => (
              <li key={r.id}>
                <button
                  className={selection?.id === r.id ? "item active" : "item"}
                  onClick={() => openReference(r)}
                >
                  <span className="dot">▤</span>
                  <span className="item-title">{r.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="reader pane-read">
          {selection ? (
            <>
              <div className="reader-head">
                <span className="kicker">{selection.kind}</span>
                <span className="reader-title">{selection.title}</span>
                {selection.kind === "lesson" && (
                  <button className="btn ghost" onClick={() => bump(selection.id, "completed")}>
                    Mark complete
                  </button>
                )}
              </div>
              <iframe className="reader-frame" title={selection.title} srcDoc={html} />
            </>
          ) : (
            <div className="center muted">Pick a lesson on the left to start reading.</div>
          )}
        </main>

        <aside className="rail pane-thread">
          <div className="section">Your questions</div>
          {questions.length === 0 && <p className="muted small">No open questions. Ask one below.</p>}
          <ul className="thread">
            {questions.map((q) => (
              <li key={q.id} className={q.state === "answered" ? "answered" : "open"}>
                <div className="q">{q.text}</div>
                {q.reply ? <div className="reply">{q.reply.text}</div> : <div className="waiting">⏳ open — answered next session</div>}
              </li>
            ))}
          </ul>
          <AskBox
            disabled={!selection || selection.kind !== "lesson"}
            onAsk={async (text) => {
              if (selection?.kind !== "lesson") return;
              await api.ask(selection.id, text);
              setQuestions(await api.openQuestions(topic.id));
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function AskBox({ disabled, onAsk }: { disabled: boolean; onAsk: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="askbox">
      <textarea
        rows={3}
        disabled={disabled}
        placeholder={disabled ? "Open a lesson to ask about it…" : "Stuck? Ask your teacher…"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="btn"
        disabled={disabled || text.trim() === ""}
        onClick={async () => {
          await onAsk(text.trim());
          setText("");
          setSent(true);
          setTimeout(() => setSent(false), 2000);
        }}
      >
        Send question
      </button>
      {sent && <span className="sent">Sent — it’s now open in your thread.</span>}
    </div>
  );
}
