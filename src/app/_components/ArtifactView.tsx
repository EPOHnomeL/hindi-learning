"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { buildSrcDoc, themeMessage, type Theme } from "./lessonSrcDoc";
import { Markdown } from "./MarkdownView";
import { internalNavTarget } from "./readerDerive";
import { useTheme } from "./ThemeContext";

// Mirror of the server's stale threshold (convex/routine.ts STALE_MS): a run
// stuck "generating" past this is treated as crashed and offered for retry.
const STALE_MS = 10 * 60 * 1000;

// Mirror of routine.ts MANUAL_COOLDOWN_MS: after an on-demand fire the button
// is disabled for this window so the daily schedule is the primary path. The
// Admin is exempt (mirrors the server-side bypass in tryAcquireGeneration) —
// otherwise the button stays hidden behind "Generated today" even though a
// manual fire would be accepted.
const MANUAL_COOLDOWN_MS = 20 * 60 * 60 * 1000;

export function ArtifactView({
  kind,
  artifactKey,
  topicSlug,
  isFrontier,
  readOnly,
  nextLessonKey,
}: {
  kind: "lesson" | "reference";
  artifactKey: string;
  topicSlug: string;
  isFrontier: boolean;
  // True for a read-only Viewer: hide every write control and skip the writes
  // the reader normally makes (progress, quiz responses). Reads stay live.
  readOnly: boolean;
  // The next lesson's key in seq order (null on the last lesson). A read-only
  // Viewer gets a "Next lesson →" link in place of the owner's controls.
  nextLessonKey?: string | null;
}) {
  if (kind === "reference") return <ReferenceView refKey={artifactKey} topicSlug={topicSlug} />;
  return (
    <LessonView
      lessonKey={artifactKey}
      topicSlug={topicSlug}
      isFrontier={isFrontier}
      readOnly={readOnly}
      nextLessonKey={nextLessonKey ?? null}
    />
  );
}

// Fills its flex parent; min height keeps it usable when the column is short
// (e.g. stacked on mobile). `theme`, when given, app-themes the artifact: the
// initial theme is baked into srcDoc and later changes are pushed live via
// postMessage so a toggle re-skins without reloading (ADR 0011). `themeCss`
// injects the dark palette too — set for references, which don't ship their own.
export function Frame({ html, withBridge, theme, themeCss }: { html: string; withBridge: boolean; theme?: Theme; themeCss?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  // Read theme via a ref so changing it does NOT rebuild srcDoc (which would
  // reload the iframe, losing scroll + answered-quiz state). The bake only needs
  // the value at build time; the effect below handles live changes.
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const srcDoc = useMemo(
    () => buildSrcDoc(html, { quiz: withBridge, theme: themeRef.current, themeCss }),
    [html, withBridge, themeCss],
  );

  // Push theme changes into the already-loaded iframe (no reload). Also fires
  // when srcDoc changes (lesson switch) so a freshly loaded frame is in sync.
  useEffect(() => {
    if (!theme) return;
    iframeRef.current?.contentWindow?.postMessage(themeMessage(theme), "*");
  }, [theme, srcDoc]);

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

  // Links inside the sandboxed artifact can't navigate the app themselves (no
  // allow-top-navigation), so the nav bridge forwards each click here. Internal
  // links route through the app (SPA nav, no full reload); everything else opens
  // in a new tab so the lesson stays put. Only messages from THIS iframe count.
  useEffect(() => {
    function onNav(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { __lesson?: boolean; type?: string; href?: unknown; newTab?: unknown };
      if (!(d?.__lesson && d.type === "navigate" && typeof d.href === "string")) return;
      let url: URL;
      try {
        url = new URL(d.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      const internal = url.origin === window.location.origin;
      if (internal) {
        const path = internalNavTarget(url.pathname, window.location.pathname) + url.search + url.hash;
        if (d.newTab) window.open(path, "_blank", "noopener,noreferrer");
        else router.push(path);
      } else {
        window.open(d.href, "_blank", "noopener,noreferrer");
      }
    }
    window.addEventListener("message", onNav);
    return () => window.removeEventListener("message", onNav);
  }, [router]);

  // Full-bleed on mobile (edge-to-edge, no side border/rounding); a bordered card
  // that fills and scrolls internally on desktop.
  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={mobile && contentH ? { height: contentH } : undefined}
      className={`w-full border-y border-line bg-card md:min-h-[60vh] md:flex-1 md:rounded-xl md:border ${contentH ? "" : "min-h-[60vh]"}`}
    />
  );
}

function LessonView({
  lessonKey,
  topicSlug,
  isFrontier,
  readOnly,
  nextLessonKey,
}: {
  lessonKey: string;
  topicSlug: string;
  isFrontier: boolean;
  readOnly: boolean;
  nextLessonKey: string | null;
}) {
  const { theme } = useTheme();
  const lesson = useQuery(api.content.getLesson, { topicSlug, key: lessonKey });
  const progress = useQuery(api.capture.myProgress, { topicSlug });
  const recordResponse = useMutation(api.capture.recordResponse);
  const setProgress = useMutation(api.capture.setProgress);

  // For a Viewer this is the *owner's* completion (read-only); for the owner,
  // their own.
  const completed = (progress ?? []).some((p) => p.lessonKey === lessonKey && p.status === "completed");

  useEffect(() => {
    // A Viewer never writes the owner's Progress (the mutation would reject anyway).
    if (lesson && !readOnly) void setProgress({ topicSlug, lessonKey, status: "opened" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.key, readOnly]);

  useEffect(() => {
    if (readOnly) return; // Viewers' quiz attempts aren't recorded against the owner.
    function onMessage(e: MessageEvent) {
      const d = e.data as { __lesson?: boolean; type?: string; quizId?: string; answer?: unknown; correct?: unknown };
      if (d?.__lesson && d.type === "response" && d.quizId) {
        void recordResponse({ topicSlug, lessonKey, quizId: d.quizId, answer: String(d.answer ?? ""), correct: Boolean(d.correct) });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [topicSlug, lessonKey, recordResponse, readOnly]);

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
            {!readOnly && isFrontier && completed && <NextLessonButton topicSlug={topicSlug} frontierKey={lessonKey} />}
            {readOnly ? (
              // A Viewer of a shared course can't change Progress; instead of a
              // read-only badge, offer plain navigation to the next lesson.
              nextLessonKey && (
                <Link
                  href={`/courses/${topicSlug}/lessons/${nextLessonKey}`}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent/90"
                >
                  Next lesson →
                </Link>
              )
            ) : (
              <button
                onClick={() => void setProgress({ topicSlug, lessonKey, status: "completed" })}
                disabled={completed}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  completed
                    ? "cursor-default border-accent2 bg-accent2 text-white"
                    : "border-accent text-accent hover:bg-hi"
                }`}
              >
                {completed ? "✓ Completed" : "Mark complete"}
              </button>
            )}
          </div>
        </div>
        <Frame html={lesson.html} withBridge theme={theme} />
        {/* Mobile: ask + answers inline right under the lesson — reliably reached by
            scrolling, no slide-up trigger. Desktop uses the side column instead. */}
        <div className="p-3 md:hidden">
          <QuestionBox topicSlug={topicSlug} lessonKey={lessonKey} variant="inline" readOnly={readOnly} />
        </div>
      </div>
      {/* Desktop: persistent ask column on the right. */}
      <aside className="hidden shrink-0 md:block md:w-80 md:overflow-y-auto">
        <QuestionBox topicSlug={topicSlug} lessonKey={lessonKey} readOnly={readOnly} />
      </aside>
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
  const amAdmin = useQuery(api.whitelist.amIAdmin);
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
  // The Admin bypasses the cooldown (mirrors tryAcquireGeneration). While amAdmin
  // is still loading (undefined) we treat the caller as non-Admin, so the gate
  // only relaxes once we've confirmed they're the Admin.
  const rateLimited =
    amAdmin !== true && gen?.lastManualFireAt != null && now - gen.lastManualFireAt < MANUAL_COOLDOWN_MS;

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
  if (rateLimited && status !== "failed") {
    return (
      <span className="text-sm text-soft" title="The daily schedule will continue authoring — this caps on-demand runs.">
        ✓ Generated today
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

function ReferenceView({ refKey, topicSlug }: { refKey: string; topicSlug: string }) {
  const { theme } = useTheme();
  const ref = useQuery(api.content.getReference, { topicSlug, key: refKey });
  if (ref === undefined) return <p className="text-soft">Loading…</p>;
  if (ref === null) return <p className="text-soft">Reference not found.</p>;
  return (
    <div className="flex flex-col gap-0 md:h-full md:gap-3">
      <h2 className="sticky top-12 z-20 truncate border-b border-line bg-paper px-3 py-2 text-lg font-semibold md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0">{ref.title}</h2>
      {/* References carry no dark CSS of their own, so themeCss injects the dark
          palette (ADR 0011) — the theme then flips them with the rest of the app. */}
      <Frame html={ref.html} withBridge={false} theme={theme} themeCss />
    </div>
  );
}

// Ask the teacher a question and see the reply once answered (live). For a
// read-only Viewer the ask form is gone, but the owner's existing Questions and
// Replies stay visible (PRD story 21).
// `panel` is the desktop side column; `inline` sits at the end of the lesson on mobile.
function QuestionBox({
  topicSlug,
  lessonKey,
  variant = "panel",
  readOnly,
}: {
  topicSlug: string;
  lessonKey: string;
  variant?: "panel" | "inline";
  readOnly: boolean;
}) {
  const questions = useQuery(api.capture.myQuestions, { topicSlug });
  const askQuestion = useMutation(api.capture.askQuestion);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState<{ text: string; reply: string } | null>(null);
  const mine = questions?.filter((q) => q.lessonKey === lessonKey) ?? [];

  return (
    <div
      className={
        variant === "inline"
          ? "rounded-xl border border-line bg-card p-4"
          : "flex h-full flex-col rounded-xl border border-line bg-card p-4"
      }
    >
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent2">
        {readOnly ? "Questions & replies" : "Ask about this lesson"}
      </h3>
      {!readOnly && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const t = text.trim();
            if (!t) return;
            setText("");
            await askQuestion({ topicSlug, lessonKey, text: t });
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Your question…" className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none" />
          <button type="submit" className="rounded-lg bg-accent2 px-3 py-2 text-sm text-white hover:bg-accent2/90">Ask</button>
        </form>
      )}
      {readOnly && mine.length === 0 && <p className="text-sm text-soft">No questions on this lesson yet.</p>}
      <ul className={`mt-3 flex flex-col gap-3 ${variant === "inline" ? "" : "min-h-0 flex-1 overflow-y-auto"}`}>
        {mine.map((q) => (
          <li key={q.id} className="text-sm">
            <p className="font-medium text-ink">{q.text}</p>
            {q.reply ? (
              <div className="mt-1.5 rounded-lg border-l-2 border-accent2 bg-hi px-3 py-2">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent2">Teacher</p>
                  {variant === "panel" && (
                    <button
                      type="button"
                      onClick={() => setExpanded({ text: q.text, reply: q.reply! })}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-soft transition-colors hover:bg-card hover:text-accent"
                    >
                      ⤢ View
                    </button>
                  )}
                </div>
                <Markdown source={q.reply} className="flex flex-col gap-2 text-sm leading-relaxed text-ink" />
              </div>
            ) : (
              <p className="mt-1 text-xs text-soft">Waiting for your teacher…</p>
            )}
          </li>
        ))}
      </ul>
      {expanded && <QaDialog question={expanded.text} reply={expanded.reply} onClose={() => setExpanded(null)} />}
    </div>
  );
}

// One Q&A opened in a comfortable reading width — the desktop ask column is only
// md:w-80, too narrow for long replies. ponytail: a near-twin of Dashboard's
// MissionDialog (native <dialog> → free Esc/backdrop/focus-trap); extract to a
// shared module if a third use appears.
function QaDialog({ question, reply, onClose }: { question: string; reply: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // click outside the content = backdrop
      }}
      className="m-auto w-[92vw] max-w-2xl rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="min-w-0 text-base font-semibold text-ink">{question}</h2>
        <button onClick={() => ref.current?.close()} aria-label="Close" className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
          ✕
        </button>
      </div>
      <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent2">Teacher</p>
        <Markdown source={reply} className="flex flex-col gap-3 text-base leading-relaxed text-ink" />
      </div>
    </dialog>
  );
}
