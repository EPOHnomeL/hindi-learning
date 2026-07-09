"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { EmblemSection } from "./Certificate";
import { Icon } from "./icons";
import { ConfirmDialog, Dialog, IconButton } from "./ui";

// The consolidated owner "Course settings" dialog (UI redesign): rename + mission
// (Details), the certificate emblem, and the completion lifecycle — the controls
// that used to be scattered across the card's inline editor and the course
// sidebar's two stacked buttons. Opened from the dashboard card (Edit / ⋯) and
// from the CourseShell sidebar. Reuses every existing mutation unchanged.
export function CourseSettingsDialog({
  topicSlug,
  status,
  onClose,
}: {
  topicSlug: string;
  status: "seeded" | "active" | "completed";
  onClose: () => void;
}) {
  return (
    <Dialog title="Course settings" onClose={onClose}>
      <div className="flex flex-col">
        <div className="pb-5">
          <DetailsSection topicSlug={topicSlug} />
        </div>
        <div className="border-t border-line py-5">
          <LessonsSection topicSlug={topicSlug} />
        </div>
        <div className="border-t border-line py-5">
          <EmblemSection topicSlug={topicSlug} />
        </div>
        <div className="border-t border-line pt-5">
          <CompletionSection topicSlug={topicSlug} status={status} />
        </div>
      </div>
    </Dialog>
  );
}

// Rename + mission. Prefills from `listTopics` (owner-scoped, so it's available
// from both entry points without threading the mission through props — the
// sidebar's `courseHeader` doesn't carry it). Seeds local state once, on first
// load, so typing isn't clobbered by the reactive query.
function DetailsSection({ topicSlug }: { topicSlug: string }) {
  const topics = useQuery(api.content.listTopics);
  const renameTopic = useMutation(api.content.renameTopic);
  const editMission = useMutation(api.content.editMission);
  const topic = topics?.find((t) => t.slug === topicSlug) ?? null;

  const [title, setTitle] = useState<string | null>(null);
  const [mission, setMission] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && topic) {
      setTitle(topic.title);
      setMission(topic.mission ?? "");
      seeded.current = true;
    }
  }, [topic]);

  const loading = title === null;

  return (
    <div>
      <h4 className="text-[13px] font-bold text-ink">Details</h4>
      <p className="mt-1 text-[12.5px] text-soft">Rename the course and curate the mission — the “why” shown on its card.</p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = (title ?? "").trim();
          if (loading || !t || !topic) return;
          setBusy(true);
          setSaved(false);
          try {
            if (t !== topic.title) await renameTopic({ topicSlug, title: t });
            if (mission.trim() !== (topic.mission ?? "")) await editMission({ topicSlug, mission: mission.trim() });
            setSaved(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wide text-accent2">Title</label>
          <input
            value={title ?? ""}
            disabled={loading}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wide text-accent2">Mission</label>
          <textarea
            value={mission}
            disabled={loading}
            onChange={(e) => {
              setMission(e.target.value);
              setSaved(false);
            }}
            rows={4}
            placeholder="Why are you learning this?"
            className="resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-60"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || loading || !(title ?? "").trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-xs font-medium text-accent2">Saved</span>}
        </div>
      </form>
    </div>
  );
}

// Manage the course's lessons — currently just deletion, behind a confirm. Lets
// the owner drop a bad lesson (e.g. one a runaway fire-and-pray run produced); the
// server cascade removes its body, learning record, and learner capture, and
// deleting the last lesson moves the Frontier back so authoring can resume there.
function LessonsSection({ topicSlug }: { topicSlug: string }) {
  const lessons = useQuery(api.content.listLessons, { topicSlug });
  const deleteLesson = useMutation(api.content.deleteLesson);
  const [pending, setPending] = useState<{ key: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <h4 className="text-[13px] font-bold text-ink">Lessons</h4>
      <p className="mt-1 text-[12.5px] text-soft">Remove a lesson you don’t want to keep. This can’t be undone.</p>

      {lessons === undefined ? (
        <p className="mt-4 text-[12.5px] text-soft">Loading…</p>
      ) : lessons.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-soft">No lessons yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line">
          {lessons.map((l) => (
            <li key={l.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="min-w-0 truncate text-sm text-ink">
                <span className="tabular-nums text-soft">{l.seq}.</span> {l.title.split("—")[0]!.trim()}
              </span>
              <IconButton
                icon="trash"
                variant="ghost"
                label={`Delete lesson ${l.title}`}
                title="Delete lesson"
                onClick={() => setPending({ key: l.key, title: l.title })}
              />
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <ConfirmDialog
          title="Delete this lesson?"
          body={`“${pending.title.split("—")[0]!.trim()}” will be permanently removed, along with its content and your progress on it. This can’t be undone.`}
          confirmLabel={busy ? "Deleting…" : "Delete lesson"}
          confirmDisabled={busy}
          onConfirm={() => {
            setBusy(true);
            void deleteLesson({ topicSlug, key: pending.key }).finally(() => {
              setBusy(false);
              setPending(null);
            });
          }}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}

// Course lifecycle (ADR 0015). "Mark complete" ends authoring behind a confirm
// (it stops the Routine); "Reopen" returns a completed course to active.
function CompletionSection({ topicSlug, status }: { topicSlug: string; status: "seeded" | "active" | "completed" }) {
  const endCourse = useMutation(api.content.endCourse);
  const reopenCourse = useMutation(api.content.reopenCourse);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "completed") {
    return (
      <div>
        <h4 className="text-[13px] font-bold text-ink">Completion</h4>
        <p className="mt-1 text-[12.5px] text-soft">
          This course is complete — no new lessons are generated, and translations are unlocked. Reopen it to keep
          adding lessons.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void reopenCourse({ topicSlug }).finally(() => setBusy(false));
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:border-transparent hover:bg-hi hover:text-accent disabled:opacity-60"
        >
          <Icon name="refresh" className="h-4 w-4" /> {busy ? "Reopening…" : "Reopen course"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-[13px] font-bold text-ink">Completion</h4>
      <p className="mt-1 text-[12.5px] text-soft">
        Marking complete ends the course — no more lessons are generated. It unlocks translations, and you can reopen it
        later.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
        <span className="text-sm text-ink">Mark this course complete</span>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
        >
          <Icon name="check" className="h-4 w-4" /> Mark complete
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title="Mark this course complete?"
          body="This ends the course — no more lessons will be generated. You can reopen it later if your goals grow."
          confirmLabel={busy ? "Ending…" : "Mark complete"}
          confirmDisabled={busy}
          onConfirm={() => {
            setBusy(true);
            void endCourse({ topicSlug }).finally(() => {
              setBusy(false);
              setConfirming(false);
            });
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
