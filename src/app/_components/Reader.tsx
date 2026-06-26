"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { ArtifactView } from "./ArtifactView";
import { useTheme } from "./ThemeContext";
import { useResourceUpload } from "./useResourceUpload";

type Selection = { kind: "lesson" | "reference"; key: string };

// localStorage key for answered-question ids the learner has already seen.
const SEEN_KEY = "hindi:answers-seen";

// Reads one course (fixed by `topicSlug`, chosen on the dashboard) and lets the
// learner work through its Lessons/References. `onExit` returns to the dashboard.
export function Reader({ topicSlug, onExit }: { topicSlug: string; onExit: () => void }) {
  const topics = useQuery(api.content.listTopics);
  const { signOut } = useAuthActions();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // This course's row (for its title + mission), from the user's Topic list.
  const activeTopic = topics?.find((t) => t.slug === topicSlug) ?? null;

  const lessons = useQuery(api.content.listLessons, { topicSlug });
  const references = useQuery(api.content.listReferences, { topicSlug });
  const progress = useQuery(api.capture.myProgress, { topicSlug });
  const questions = useQuery(api.capture.myQuestions, { topicSlug });

  // Answered-question ids the learner has already seen (client-only, per device).
  // A lesson with a reply not in this set gets a notification dot in the nav;
  // opening that lesson marks its answers seen and clears the dot.
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw) setSeen(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* unavailable or corrupt storage — start empty */
    }
  }, []);

  // lessonKey -> status, so the nav can show what's already completed.
  const completed = new Set((progress ?? []).filter((p) => p.status === "completed").map((p) => p.lessonKey));

  // Lessons with a teacher reply the learner hasn't seen yet → show a dot.
  const unseenAnswers = new Set<string>();
  for (const q of questions ?? []) if (q.reply && !seen.has(q.id)) unseenAnswers.add(q.lessonKey);

  // The Frontier: the last (highest-seq) lesson. listLessons is seq-ascending.
  const frontierKey = lessons && lessons.length > 0 ? lessons[lessons.length - 1]!.key : null;

  // Default to the first lesson once they load.
  const current = selected ?? (lessons && lessons.length > 0 ? { kind: "lesson" as const, key: lessons[0]!.key } : null);

  // Viewing a lesson counts as seeing its answers — mark them so the dot clears.
  useEffect(() => {
    if (current?.kind !== "lesson" || !questions) return;
    const ids = questions.filter((q) => q.lessonKey === current.key && q.reply).map((q) => q.id);
    if (ids.length === 0) return;
    setSeen((prev) => {
      if (ids.every((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [current?.key, questions]);

  // Selecting from the drawer closes it (mobile); a no-op on desktop.
  const select = (s: Selection) => {
    setSelected(s);
    setMenuOpen(false);
  };

  return (
    <div className="flex min-h-dvh flex-col md:h-screen md:flex-row md:overflow-hidden">
      {/* Mobile top bar: hamburger opens the lesson selector. Sticky + fixed h-12 so
          the lesson/reference title bar can pin directly beneath it (top-12). */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-paper px-3 md:hidden">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open lessons"
          className="rounded-lg p-1.5 text-ink hover:bg-hi"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-base font-semibold tracking-tight text-accent">{activeTopic?.title ?? "…"}</h1>
      </header>

      {/* Backdrop behind the drawer (mobile only). */}
      {menuOpen && <div onClick={() => setMenuOpen(false)} aria-hidden className="fixed inset-0 z-40 bg-black/40 md:hidden" />}

      {/* Lesson selector: slide-in drawer on mobile, static column on desktop. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col overflow-y-auto border-r border-line bg-paper p-4 transition-transform duration-300 md:static md:z-auto md:w-64 md:translate-x-0 md:transition-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            onClick={onExit}
            className="-ml-1 flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
            aria-label="Back to courses"
          >
            <span aria-hidden>←</span> Courses
          </button>
          <button onClick={() => void signOut()} className="shrink-0 text-xs text-soft hover:text-accent">
            Sign out
          </button>
        </div>
        <h1 className="mb-4 truncate text-lg font-semibold tracking-tight text-accent">{activeTopic?.title ?? "…"}</h1>

        <nav className="flex flex-col gap-1">
          <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-accent2">Lessons</p>
          {lessons?.length === 0 && <p className="px-2 text-sm text-soft">No lessons published yet.</p>}
          {lessons?.map((l) => (
            <NavItem
              key={l.key}
              active={current?.kind === "lesson" && current.key === l.key}
              done={completed.has(l.key)}
              notify={unseenAnswers.has(l.key)}
              onClick={() => select({ kind: "lesson", key: l.key })}
            >
              {l.seq}. {l.title.split("—")[0]!.trim()}
            </NavItem>
          ))}

          <p className="px-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">References</p>
          {references?.map((r) => (
            <NavItem key={r.key} active={current?.kind === "reference" && current.key === r.key} onClick={() => select({ kind: "reference", key: r.key })}>
              {r.title}
            </NavItem>
          ))}

          {topicSlug && <ResourcesSection topicSlug={topicSlug} />}
        </nav>

        {/* Theme setting, pinned at the bottom of the drawer. Flips the whole app
            and the served lesson together (ADR 0011). */}
        <ThemeToggle />
      </aside>

      <section className="min-w-0 flex-1 md:overflow-hidden md:p-4">
        {current && topicSlug ? (
          <ArtifactView
            kind={current.kind}
            artifactKey={current.key}
            topicSlug={topicSlug}
            isFrontier={current.kind === "lesson" && current.key === frontierKey}
          />
        ) : (
          <p className="p-4 text-soft">Select a lesson.</p>
        )}
      </section>
    </div>
  );
}

// Light/Dark toggle pinned to the bottom of the sidebar. `mt-auto` pushes it
// below the nav lists; it themes the app chrome and the lesson iframe at once.
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
    >
      <span>{dark ? "Dark" : "Light"} mode</span>
      <span aria-hidden className="text-base">{dark ? "☾" : "☀"}</span>
    </button>
  );
}

function NavItem({
  active,
  done = false,
  notify = false,
  onClick,
  children,
}: {
  active: boolean;
  done?: boolean;
  notify?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-accent text-white" : "text-ink hover:bg-hi"
      }`}
    >
      <span className="min-w-0">{children}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {notify && (
          <span
            aria-label="New reply from your teacher"
            title="Your teacher answered a question here"
            className={`h-2 w-2 rounded-full ${active ? "bg-white" : "bg-gold"}`}
          />
        )}
        {done && (
          <span aria-label="completed" title="Completed" className={`text-xs ${active ? "text-white" : "text-accent2"}`}>
            ✓
          </span>
        )}
      </span>
    </button>
  );
}

// The active Topic's Resources — PDFs (uploaded) and links — each opening in a
// new tab. Add more by uploading a file or pasting a link.
function ResourcesSection({ topicSlug }: { topicSlug: string }) {
  const resources = useQuery(api.resources.listResources, { topicSlug });
  const { uploadFile, addLink } = useResourceUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [adding, setAdding] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <p className="px-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">Resources</p>
      {resources?.length === 0 && <p className="px-2 text-sm text-soft">No resources yet.</p>}
      {resources?.map((r) =>
        r.url ? (
          <a
            key={r.id}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-hi"
          >
            <span className="min-w-0 truncate">
              <span aria-hidden className="mr-1 text-soft">{r.kind === "url" ? "🔗" : "📄"}</span>
              {r.filename}
            </span>
            {r.status !== "ready" && r.status !== "raw" && <span className="shrink-0 text-xs text-soft">{r.status}</span>}
          </a>
        ) : (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-soft">
            <span className="min-w-0 truncate">{r.filename}</span>
            <span className="shrink-0 text-xs">{r.status}</span>
          </div>
        ),
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void run(() => uploadFile(topicSlug, file));
        }}
      />
      {adding ? (
        <form
          className="mt-1 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const link = linkDraft.trim();
            if (!link) return;
            setLinkDraft("");
            setAdding(false);
            void run(() => addLink(topicSlug, link));
          }}
        >
          <input
            autoFocus
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            placeholder="https://…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1 text-sm focus:border-gold focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-accent2 px-2 py-1 text-xs text-white">Add</button>
        </form>
      ) : (
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex-1 rounded-lg border border-dashed border-line px-2 py-1.5 text-left text-sm text-soft hover:bg-hi disabled:opacity-60"
          >
            {busy ? "Working…" : "+ Upload PDF"}
          </button>
          <button
            onClick={() => setAdding(true)}
            disabled={busy}
            className="rounded-lg border border-dashed border-line px-2 py-1.5 text-sm text-soft hover:bg-hi disabled:opacity-60"
          >
            + Link
          </button>
        </div>
      )}
    </>
  );
}
