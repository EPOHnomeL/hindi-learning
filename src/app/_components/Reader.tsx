"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { ArtifactView } from "./ArtifactView";

type Selection = { kind: "lesson" | "reference"; key: string };

// v1 serves a single Topic; a switcher arrives with multi-topic.
const TOPIC_SLUG = "hindi";

export function Reader() {
  const lessons = useQuery(api.content.listLessons);
  const references = useQuery(api.content.listReferences);
  const progress = useQuery(api.capture.myProgress);
  const { signOut } = useAuthActions();
  const [selected, setSelected] = useState<Selection | null>(null);

  // lessonKey -> status, so the nav can show what's already completed.
  const completed = new Set((progress ?? []).filter((p) => p.status === "completed").map((p) => p.lessonKey));

  // The Frontier: the last (highest-seq) lesson. listLessons is seq-ascending.
  const frontierKey = lessons && lessons.length > 0 ? lessons[lessons.length - 1]!.key : null;

  // Default to the first lesson once they load.
  const current = selected ?? (lessons && lessons.length > 0 ? { kind: "lesson" as const, key: lessons[0]!.key } : null);

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <aside className="shrink-0 border-b border-line p-4 md:w-64 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-accent">Hindi</h1>
          <button onClick={() => void signOut()} className="text-xs text-soft hover:text-accent">
            Sign out
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-accent2">Lessons</p>
          {lessons?.length === 0 && <p className="px-2 text-sm text-soft">No lessons published yet.</p>}
          {lessons?.map((l) => (
            <NavItem
              key={l.key}
              active={current?.kind === "lesson" && current.key === l.key}
              done={completed.has(l.key)}
              onClick={() => setSelected({ kind: "lesson", key: l.key })}
            >
              {l.seq}. {l.title.split("—")[0]!.trim()}
            </NavItem>
          ))}

          <p className="px-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">References</p>
          {references?.map((r) => (
            <NavItem key={r.key} active={current?.kind === "reference" && current.key === r.key} onClick={() => setSelected({ kind: "reference", key: r.key })}>
              {r.title}
            </NavItem>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1 p-4 md:overflow-hidden">
        {current ? (
          <ArtifactView
            kind={current.kind}
            artifactKey={current.key}
            topicSlug={TOPIC_SLUG}
            isFrontier={current.kind === "lesson" && current.key === frontierKey}
          />
        ) : (
          <p className="text-soft">Select a lesson.</p>
        )}
      </section>
    </div>
  );
}

function NavItem({
  active,
  done = false,
  onClick,
  children,
}: {
  active: boolean;
  done?: boolean;
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
      {done && (
        <span
          aria-label="completed"
          title="Completed"
          className={`shrink-0 text-xs ${active ? "text-white" : "text-accent2"}`}
        >
          ✓
        </span>
      )}
    </button>
  );
}
