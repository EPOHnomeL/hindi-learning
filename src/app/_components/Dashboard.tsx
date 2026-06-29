"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { parseMarkdown, type Span } from "./markdown";
import { useResourceUpload } from "./useResourceUpload";

type Course = {
  slug: string;
  title: string;
  status: "seeded" | "active";
  mission: string | null;
  lessonCount: number;
  completedCount: number;
};

type SharedCourse = {
  slug: string;
  title: string;
  ownerEmail: string | null;
  lessonCount: number;
  completedCount: number;
};

// The home dashboard (`/`): the course grid (create / edit / open) plus the
// "Shared with me" section. Opening a course is now a real navigation to
// /courses/[slug] (ADR 0012), not a local view toggle.
export function Dashboard() {
  const courses = useQuery(api.content.dashboard);
  const amAdmin = useQuery(api.whitelist.amIAdmin);
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Served Teach</h1>
          <p className="mt-0.5 text-sm text-soft">Your courses</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {amAdmin && (
            <Link href="/admin" className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
              Admin
            </Link>
          )}
          <button onClick={() => void signOut().then(() => router.replace("/"))} className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
            Sign out
          </button>
        </div>
      </header>

      {courses === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-card" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.slug} course={c} />
          ))}
          <NewCourseCard />
        </div>
      )}

      <SharedSection />
    </div>
  );
}

// Courses other learners have shared with me — read-only. Hidden when none.
function SharedSection() {
  const shared = useQuery(api.shares.listSharedTopics);
  if (!shared || shared.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-1 text-lg font-semibold tracking-tight text-accent">Shared with me</h2>
      <p className="mb-4 text-sm text-soft">Courses others have shared with you — view only.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shared.map((c) => (
          <SharedCourseCard key={c.slug} course={c} />
        ))}
      </div>
    </section>
  );
}

// A shared course: same shape as CourseCard but attributed to its owner and with
// no Edit/Share controls — a Viewer reads, never writes.
function SharedCourseCard({ course }: { course: SharedCourse }) {
  const pct = course.lessonCount > 0 ? Math.round((course.completedCount / course.lessonCount) * 100) : 0;
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold leading-snug text-ink">{course.title}</h2>
        <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">Shared</span>
      </div>

      <p className="mb-4 min-h-10 text-sm text-soft">
        Shared by <span className="text-ink">{course.ownerEmail ?? "another learner"}</span>
      </p>

      <div className="mb-4 mt-auto">
        <div className="mb-1 flex items-center justify-between text-xs text-soft">
          <span>
            {course.lessonCount === 0 ? (
              "No lessons yet"
            ) : (
              <>
                <span className="tabular-nums font-medium text-ink">{course.completedCount}</span> / {course.lessonCount} lessons
              </>
            )}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent2 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Link
        href={`/courses/${course.slug}`}
        className="w-full rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
      >
        Open course
      </Link>
    </article>
  );
}

function CourseCard({ course }: { course: Course }) {
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showMission, setShowMission] = useState(false);
  const requestSetup = useAction(api.routine.requestSetup);
  const [setup, setSetup] = useState<"idle" | "starting" | "started" | "error">("idle");

  if (editing) {
    return <CardEditor course={course} onDone={() => setEditing(false)} />;
  }
  if (sharing) {
    return <SharePanel course={course} onDone={() => setSharing(false)} />;
  }

  const pct = course.lessonCount > 0 ? Math.round((course.completedCount / course.lessonCount) * 100) : 0;
  const allDone = course.lessonCount > 0 && course.completedCount === course.lessonCount;

  const startSetup = async () => {
    setSetup("starting");
    try {
      await requestSetup({ topicSlug: course.slug });
      setSetup("started");
    } catch {
      setSetup("error");
    }
  };

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold leading-snug text-ink">{course.title}</h2>
        {course.status === "seeded" && (
          <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">Setting up</span>
        )}
      </div>

      {course.mission ? (
        <button
          onClick={() => setShowMission(true)}
          title="View full mission"
          className="mb-4 line-clamp-2 min-h-10 text-left text-sm text-soft transition-colors hover:text-accent"
        >
          {course.mission}
        </button>
      ) : (
        <p className="mb-4 min-h-10 text-sm text-soft">
          {course.status === "seeded" ? "Your teacher is preparing the first lesson." : "No mission yet."}
        </p>
      )}
      {showMission && course.mission && (
        <MissionDialog title={course.title} mission={course.mission} onClose={() => setShowMission(false)} />
      )}

      {/* Progress */}
      <div className="mb-4 mt-auto">
        <div className="mb-1 flex items-center justify-between text-xs text-soft">
          <span>
            {course.lessonCount === 0 ? (
              "No lessons yet"
            ) : (
              <>
                <span className="tabular-nums font-medium text-ink">{course.completedCount}</span> / {course.lessonCount} lessons
              </>
            )}
          </span>
          {allDone && <span className="font-medium text-accent2">✓ Complete</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent2 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {course.status === "seeded" && (
        <button
          onClick={() => void startSetup()}
          disabled={setup === "starting" || setup === "started"}
          className="mb-2 w-full rounded-lg bg-gold/20 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-gold/30 disabled:opacity-70"
        >
          {setup === "starting"
            ? "Starting setup…"
            : setup === "started"
              ? "Setup started — first lesson in ~1 min"
              : setup === "error"
                ? "Couldn't start — retry"
                : "Set up now"}
        </button>
      )}

      <div className="flex items-center gap-2">
        <Link
          href={`/courses/${course.slug}`}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Open course
        </Link>
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
          aria-label={`Edit ${course.title}`}
        >
          Edit
        </button>
        <button
          onClick={() => setSharing(true)}
          className="rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
          aria-label={`Share ${course.title}`}
        >
          Share
        </button>
      </div>
    </article>
  );
}

// The Mission rendered as Markdown in a popup. Uses the native <dialog> element,
// so Esc-to-close, the backdrop, and focus trapping come for free (no UI dep).
function MissionDialog({ title, mission, onClose }: { title: string; mission: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // click outside the content = backdrop
      }}
      className="m-auto w-[90vw] max-w-lg rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="min-w-0 truncate text-base font-semibold text-accent">{title}</h2>
        <button onClick={() => ref.current?.close()} aria-label="Close" className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
          ✕
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <Markdown source={mission} />
      </div>
    </dialog>
  );
}

function Markdown({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink">
      {parseMarkdown(source).map((b, i) => {
        if (b.kind === "heading") {
          const Tag = `h${Math.min(b.level + 1, 6)}` as "h2" | "h3" | "h4" | "h5" | "h6";
          return (
            <Tag key={i} className="font-semibold text-accent">
              {renderSpans(b.spans)}
            </Tag>
          );
        }
        if (b.kind === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={`ml-5 flex flex-col gap-1 ${b.ordered ? "list-decimal" : "list-disc"}`}>
              {b.items.map((item, j) => (
                <li key={j}>{renderSpans(item)}</li>
              ))}
            </Tag>
          );
        }
        return <p key={i}>{renderSpans(b.spans)}</p>;
      })}
    </div>
  );
}

function renderSpans(spans: Span[]) {
  return spans.map((s, i) => {
    switch (s.kind) {
      case "strong":
        return <strong key={i} className="font-semibold text-ink">{s.text}</strong>;
      case "em":
        return <em key={i}>{s.text}</em>;
      case "code":
        return <code key={i} className="rounded bg-hi px-1 py-0.5 text-[0.85em]">{s.text}</code>;
      case "link":
        return (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="text-accent2 underline underline-offset-2">
            {s.text}
          </a>
        );
      default:
        return <span key={i}>{s.text}</span>;
    }
  });
}

// Share a course with another learner by their account email (read-only access).
// Slice 01: add-by-email only; listing/revoking current Viewers is issue 06.
function SharePanel({ course, onDone }: { course: Course; onDone: () => void }) {
  const shareTopic = useMutation(api.shares.shareTopic);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedWith, setSharedWith] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const addr = email.trim();
        if (!addr) return;
        setBusy(true);
        setError(null);
        try {
          await shareTopic({ topicSlug: course.slug, email: addr });
          setSharedWith(addr);
          setEmail("");
        } catch {
          setError("Couldn't share — check the email belongs to a registered account.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Share “{course.title}”</label>
      <p className="text-sm text-soft">They’ll get read-only access — view your lessons, but not edit anything.</p>
      <input
        autoFocus
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        placeholder="Their account email"
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {sharedWith && <p className="text-xs text-accent2">Shared with {sharedWith}.</p>}
      <div className="mt-1 flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Sharing…" : "Share"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hi">
          Done
        </button>
      </div>
    </form>
  );
}

// Inline edit: rename the course + curate its Mission (the "why").
function CardEditor({ course, onDone }: { course: Course; onDone: () => void }) {
  const renameTopic = useMutation(api.content.renameTopic);
  const editMission = useMutation(api.content.editMission);
  const [title, setTitle] = useState(course.title);
  const [mission, setMission] = useState(course.mission ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        setBusy(true);
        try {
          if (t !== course.title) await renameTopic({ topicSlug: course.slug, title: t });
          if (mission.trim() !== (course.mission ?? "")) await editMission({ topicSlug: course.slug, mission: mission.trim() });
          onDone();
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <label className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent2">Mission</label>
      <textarea
        value={mission}
        onChange={(e) => setMission(e.target.value)}
        rows={4}
        placeholder="Why are you learning this?"
        className="resize-none rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <div className="mt-1 flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hi">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Seed a new course (title + free-text "why"); the Routine drafts the Mission +
// first Lesson on its next run. On create, open it so they can upload Resources.
function NewCourseCard() {
  const seedTopic = useMutation(api.content.seedTopic);
  const requestSetup = useAction(api.routine.requestSetup);
  const { uploadFile, addLink } = useResourceUpload();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const addDraftLink = () => {
    const l = linkDraft.trim();
    if (l) setLinks((xs) => [...xs, l]);
    setLinkDraft("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-44 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line p-5 text-soft transition-colors hover:border-gold/60 hover:bg-hi/40 hover:text-accent"
      >
        <span className="text-2xl leading-none" aria-hidden>
          +
        </span>
        <span className="text-sm font-medium">New course</span>
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        setBusy(true);
        try {
          const { slug } = await seedTopic({ title: t, why: why.trim() });
          for (const l of links) await addLink(slug, l);
          for (const f of files) await uploadFile(slug, f);
          // Kick off setup immediately, once Resources are attached — no waiting
          // for the daily cron. Best-effort: if the fire can't land, the card
          // still shows "Setting up" (with a "Set up now" retry) and the cron
          // picks it up anyway, so a failure here must not block creation.
          try {
            await requestSetup({ topicSlug: slug });
          } catch (err) {
            console.warn("couldn't start setup immediately; the routine will pick it up", err);
          }
          setTitle("");
          setWhy("");
          setLinks([]);
          setFiles([]);
          setOpen(false);
          router.push(`/courses/${slug}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">New course</label>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Course title"
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <textarea
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        rows={3}
        placeholder="Why are you learning this?"
        className="resize-none rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />

      <label className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent2">Resources (optional)</label>
      {(links.length > 0 || files.length > 0) && (
        <ul className="flex flex-col gap-1">
          {links.map((l, i) => (
            <li key={`l-${i}`} className="flex items-center justify-between gap-2 rounded bg-hi/50 px-2 py-1 text-xs text-ink">
              <span className="min-w-0 truncate">🔗 {l}</span>
              <button type="button" onClick={() => setLinks((xs) => xs.filter((_, j) => j !== i))} className="shrink-0 text-soft hover:text-accent" aria-label="Remove link">✕</button>
            </li>
          ))}
          {files.map((f, i) => (
            <li key={`f-${i}`} className="flex items-center justify-between gap-2 rounded bg-hi/50 px-2 py-1 text-xs text-ink">
              <span className="min-w-0 truncate">📄 {f.name}</span>
              <button type="button" onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))} className="shrink-0 text-soft hover:text-accent" aria-label="Remove file">✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1">
        <input
          value={linkDraft}
          onChange={(e) => setLinkDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraftLink();
            }
          }}
          placeholder="Paste a link…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1.5 text-sm focus:border-gold focus:outline-none"
        />
        <button type="button" onClick={addDraftLink} className="rounded-lg border border-line px-2 py-1.5 text-sm text-soft hover:bg-hi">
          Add link
        </button>
      </div>
      <label className="cursor-pointer rounded-lg border border-dashed border-line px-2 py-1.5 text-center text-sm text-soft hover:bg-hi">
        + Attach PDF{files.length > 0 ? "s" : ""}
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) setFiles((xs) => [...xs, ...picked]);
            e.target.value = "";
          }}
        />
      </label>

      <div className="mt-1 flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hi">
          Cancel
        </button>
      </div>
    </form>
  );
}
