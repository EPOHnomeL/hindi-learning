"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { ArtifactView } from "./ArtifactView";

type Selection = { kind: "lesson" | "reference"; key: string };

export function Reader() {
  const lessons = useQuery(api.content.listLessons);
  const references = useQuery(api.content.listReferences);
  const { signOut } = useAuthActions();
  const [selected, setSelected] = useState<Selection | null>(null);

  // Default to the first lesson once they load.
  const current = selected ?? (lessons && lessons.length > 0 ? { kind: "lesson" as const, key: lessons[0]!.key } : null);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row">
      <aside className="md:w-64 md:shrink-0">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Hindi</h1>
          <button onClick={() => void signOut()} className="text-xs text-stone-500 hover:text-stone-800">
            Sign out
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          <p className="px-2 pt-2 text-xs font-medium uppercase tracking-wide text-stone-400">Lessons</p>
          {lessons?.length === 0 && <p className="px-2 text-sm text-stone-400">No lessons published yet.</p>}
          {lessons?.map((l) => (
            <NavItem key={l.key} active={current?.kind === "lesson" && current.key === l.key} onClick={() => setSelected({ kind: "lesson", key: l.key })}>
              {l.seq}. {l.title}
            </NavItem>
          ))}

          <p className="px-2 pt-4 text-xs font-medium uppercase tracking-wide text-stone-400">References</p>
          {references?.map((r) => (
            <NavItem key={r.key} active={current?.kind === "reference" && current.key === r.key} onClick={() => setSelected({ kind: "reference", key: r.key })}>
              {r.title}
            </NavItem>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        {current ? (
          <ArtifactView kind={current.kind} artifactKey={current.key} />
        ) : (
          <p className="text-stone-400">Select a lesson.</p>
        )}
      </section>
    </div>
  );
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2 py-1.5 text-left text-sm ${active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-200"}`}
    >
      {children}
    </button>
  );
}
