"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Reader } from "./Reader";

type Course = {
  slug: string;
  title: string;
  status: "seeded" | "active";
  mission: string | null;
  lessonCount: number;
  completedCount: number;
};

// The home dashboard. Picks a course → opens the Reader; otherwise shows the
// course grid (create / edit / open). View state is local — instant, no routing.
export function Dashboard() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  if (openSlug) return <Reader topicSlug={openSlug} onExit={() => setOpenSlug(null)} />;
  return <CourseGrid onOpen={setOpenSlug} />;
}

function CourseGrid({ onOpen }: { onOpen: (slug: string) => void }) {
  const courses = useQuery(api.content.dashboard);
  const { signOut } = useAuthActions();

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Served Teach</h1>
          <p className="mt-0.5 text-sm text-soft">Your courses</p>
        </div>
        <button onClick={() => void signOut()} className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
          Sign out
        </button>
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
            <CourseCard key={c.slug} course={c} onOpen={() => onOpen(c.slug)} />
          ))}
          <NewCourseCard onCreated={onOpen} />
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <CardEditor course={course} onDone={() => setEditing(false)} />;
  }

  const pct = course.lessonCount > 0 ? Math.round((course.completedCount / course.lessonCount) * 100) : 0;
  const allDone = course.lessonCount > 0 && course.completedCount === course.lessonCount;

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold leading-snug text-ink">{course.title}</h2>
        {course.status === "seeded" && (
          <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">Setting up</span>
        )}
      </div>

      <p className="mb-4 line-clamp-2 min-h-10 text-sm text-soft">
        {course.mission ?? (course.status === "seeded" ? "Your teacher is preparing the first lesson." : "No mission yet.")}
      </p>

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

      <div className="flex items-center gap-2">
        <button
          onClick={onOpen}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Open course
        </button>
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
          aria-label={`Edit ${course.title}`}
        >
          Edit
        </button>
      </div>
    </article>
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
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <label className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent2">Mission</label>
      <textarea
        value={mission}
        onChange={(e) => setMission(e.target.value)}
        rows={4}
        placeholder="Why are you learning this?"
        className="resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none"
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
function NewCourseCard({ onCreated }: { onCreated: (slug: string) => void }) {
  const seedTopic = useMutation(api.content.seedTopic);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);

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
          setTitle("");
          setWhy("");
          setOpen(false);
          onCreated(slug);
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
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <textarea
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        rows={3}
        placeholder="Why are you learning this?"
        className="resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
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
