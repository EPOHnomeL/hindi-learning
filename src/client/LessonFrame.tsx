import { useEffect, useRef } from "react";

export type QuizResponse = { promptId: string; kind: "quiz" | "free_text"; value: string; correctness: boolean };

/**
 * Embeds a Lesson/Reference HTML artifact and sizes the iframe to its content
 * height so the whole reader pane scrolls as one. Internal iframe scrolling is
 * avoided — mobile WebKit only paints the first slice of a scrolling srcDoc
 * iframe, leaving the rest blank. srcDoc is same-origin, so we can measure the
 * content directly and re-measure as web fonts load or quizzes expand.
 */
export function LessonFrame({
  html,
  title,
  onResponse,
}: {
  html: string;
  title: string;
  onResponse?: (r: QuizResponse) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    const fit = () => {
      const doc = frame.contentDocument;
      if (doc?.documentElement) frame.style.height = `${doc.documentElement.scrollHeight}px`;
    };
    const onLoad = () => {
      fit();
      const doc = frame.contentDocument;
      if (doc?.documentElement) {
        observer = new ResizeObserver(fit);
        observer.observe(doc.documentElement);
        if (onResponse) wireQuizCapture(doc, onResponse);
      }
    };
    frame.addEventListener("load", onLoad);
    const t = setTimeout(fit, 400); // catch already-loaded / late font metrics
    return () => {
      frame.removeEventListener("load", onLoad);
      observer?.disconnect();
      clearTimeout(t);
    };
  }, [html, onResponse]);
  return <iframe ref={ref} className="reader-frame" title={title} srcDoc={html} scrolling="no" />;
}

/**
 * Reads a learner's first answer to each quiz in the (same-origin) lesson and
 * reports it as a Response. Hooks the authored quiz markup — `.quiz[data-correct]`
 * multiple-choice and `.quiz.fill[data-answer]` fill-in — so lessons stay pure,
 * self-contained artifacts. promptId is the quiz's ordinal in the lesson (q1, q2,
 * …); stable because lessons are immutable (ADR-0003). One Response per prompt:
 * the first attempt is the signal of what was mastered.
 */
function wireQuizCapture(doc: Document, onResponse: (r: QuizResponse) => void) {
  const captured = new Set<string>();
  const report = (r: QuizResponse) => {
    if (captured.has(r.promptId)) return;
    captured.add(r.promptId);
    onResponse(r);
  };
  doc.querySelectorAll<HTMLElement>(".quiz").forEach((quiz, i) => {
    const promptId = `q${i + 1}`;
    if (quiz.classList.contains("fill")) {
      const answer = quiz.getAttribute("data-answer");
      const alt = quiz.getAttribute("data-alt");
      const input = quiz.querySelector("input");
      const submit = () => {
        const value = (input?.value ?? "").replace(/\s+/g, " ").trim();
        if (value === "") return;
        report({ promptId, kind: "quiz", value, correctness: value === answer || value === alt });
      };
      quiz.querySelector("button")?.addEventListener("click", submit);
      input?.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") submit();
      });
    } else {
      const correct = quiz.getAttribute("data-correct");
      quiz.querySelectorAll<HTMLElement>(".opt").forEach((opt) => {
        opt.addEventListener("click", () => {
          const key = opt.getAttribute("data-k");
          report({
            promptId,
            kind: "quiz",
            value: (opt.textContent ?? "").replace(/\s+/g, " ").trim(),
            correctness: key === correct,
          });
        });
      });
    }
  });
}
