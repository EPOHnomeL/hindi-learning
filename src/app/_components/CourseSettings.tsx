"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { EmblemSection } from "./Certificate";
import { Icon } from "./icons";
import { useMutationRun } from "./mutationRun";
import { ConfirmDialog, IconButton } from "./ui";

// "Course settings" (UI redesign): Details, the certificate emblem, and the
// completion lifecycle. Details follows a target Edition (`lang`): on a
// translated Edition it edits that Edition's title & mission (replacing the old
// title pencil); on the English source it edits the source. It self-resolves the
// served Edition from `lang` via `courseHeader`, so a caller just passes a
// language.
//
// It has ONE home as of 2026-09-08: the manage route's Course settings tab. The
// dashboard card's kebab was the other door, and both it and the dialog wrapper
// this file used to export went with it, so there is no longer a second place to
// change a course from.
//
// The `owner={false}` branch below, an Editor's Details-only view, is DEAD CODE:
// nothing renders it. Commit e228ba5 (2026-08-23) removed the reader's door when
// it trimmed the reader drawer to lessons, references and resources, and that
// commit message records the cost in its own words, "a translated Edition Editor
// loses the Details door". The branch is kept rather than deleted because
// ui-overhaul 17 decided the door returns in the reader, Details only, gated on
// the per-Edition `canEdit` that `courseHeader` already computes server side (ADR
// 0020). Ticket 20 revives it.
export function CourseSettingsBody({
  topicSlug,
  status,
  owner = true,
  lang = null,
}: {
  topicSlug: string;
  status: "seeded" | "active" | "completed";
  owner?: boolean;
  lang?: string | null;
}) {
  const t = useTranslations("CourseSettings");
  const translated = lang != null && lang !== "en";
  // Self-resolve the served Edition (owner-deduped: the reader already holds this
  // exact query). Skipped entirely on the English source.
  const header = useQuery(api.content.reader.courseHeader, translated ? { topicSlug, lang } : "skip");
  const edition =
    translated && header
      ? {
          lang: header.lang,
          native: header.editions.find((e) => e.lang === header.lang)?.native ?? header.lang,
          title: header.title,
          mission: header.mission,
        }
      : null;

  return (
    <div className="flex flex-col">
      <div className={owner ? "pb-5" : ""}>
        {translated ? (
          edition ? (
            <EditionDetailsSection topicSlug={topicSlug} edition={edition} />
          ) : (
            <p className="text-[0.78rem] text-soft">{t("loading")}</p>
          )
        ) : (
          <DetailsSection topicSlug={topicSlug} />
        )}
      </div>
      {owner && (
        <>
          <div className="border-t border-line py-5">
            <TeacherQaSection topicSlug={topicSlug} />
          </div>
          <div className="border-t border-line py-5">
            <LessonsSection topicSlug={topicSlug} />
          </div>
          <div className="border-t border-line py-5">
            <EmblemSection topicSlug={topicSlug} />
          </div>
          <div className="border-t border-line py-5">
            <CompletionSection topicSlug={topicSlug} status={status} />
          </div>
          <div className="border-t border-line pt-5">
            <DeleteSection topicSlug={topicSlug} />
          </div>
        </>
      )}
    </div>
  );
}

// Teacher Q&A (teacher-qa): whether this COURSE offers a question channel at
// all, as an on/off toggle. Per Topic and pedagogical, which is why ui-overhaul
// 17 moved it here from the per-Edition sharing panel: in a course-scoped
// surface it needs no guard and no "applies to the whole course" disclaimer.
// Owner-only server-side (capture.setTeacherQa).
//
// Reads its current value from the reader's own course bundle
// (content.reader.courseHeader), where an absent field resolves to ON. Distinct
// from the `qa` TENANT feature flag, which is the admin portal's.
function TeacherQaSection({ topicSlug }: { topicSlug: string }) {
  const t = useTranslations("CourseSettings");
  const header = useQuery(api.content.reader.courseHeader, { topicSlug });
  // Was a `finally` with no `catch`: a refused toggle (the tenant's `qa` flag
  // off, not the owner) snapped back with nothing said. Ticket 32.
  const { run, busy, error } = useMutationRun(useMutation(api.capture.setTeacherQa), t("updateError"));
  // Absence means ON, and so does a header still loading: the toggle must never
  // flash "off" on a course whose Q&A is open.
  const on = header?.teacherQa ?? true;

  return (
    <div>
      <h4 className="text-[0.8125rem] font-bold text-ink">{t("teacherQa")}</h4>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors ${
              on ? "bg-accent2/15 text-accent2" : "bg-hi text-soft"
            }`}
          >
            <Icon name="chat" className="h-4.5 w-4.5" />
          </span>
          <span className="text-[0.72rem] text-soft">
            {on ? t("teacherQaOn") : t("teacherQaOff")}
            {error && <span className="block text-danger">{error}</span>}
          </span>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={on}
            disabled={busy || header === undefined}
            onChange={(e) => void run({ topicSlug, enabled: e.target.checked })}
            className="peer sr-only"
          />
          <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] motion-reduce:after:transition-none peer-checked:bg-accent2 ltr:peer-checked:after:translate-x-4.5 rtl:peer-checked:after:-translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
        </label>
      </div>
    </div>
  );
}

// Details for a translated Edition (edition-title-edit 02): edit its title &
// mission in place. Rendered as the Details section of Course settings when the
// target is a translated Edition, gated by the server-computed per-Edition
// `canEdit` (owner or that Edition's Editor, ADR 0020). Clearing a field reverts
// it to auto: the translated row is dropped, the reader falls back to the
// English text, and the next re-translate fills it again.
function EditionDetailsSection({
  topicSlug,
  edition: { lang, native, title: servedTitle, mission: servedMission },
}: {
  topicSlug: string;
  edition: { lang: string; native: string; title: string; mission: string | null };
}) {
  const t = useTranslations("CourseSettings");
  const edit = useMutation(api.translate.editEditionText);
  const [title, setTitle] = useState(servedTitle);
  const [mission, setMission] = useState(servedMission ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <h4 className="text-[0.8125rem] font-bold text-ink">{t("editionDetailsHeading", { native })}</h4>
      <p className="mt-1 text-[0.78rem] text-soft">{t("editionDetailsBody")}</p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setSaved(false);
          try {
            if (title.trim() !== servedTitle) await edit({ topicSlug, lang, kind: "title", text: title.trim() });
            if (servedMission !== null && mission.trim() !== servedMission)
              await edit({ topicSlug, lang, kind: "mission", text: mission.trim() });
            setSaved(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.6875rem] font-bold uppercase tracking-label text-accent2">{t("titleLabel")}</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
        </div>
        {servedMission !== null && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.6875rem] font-bold uppercase tracking-label text-accent2">{t("missionLabel")}</label>
            <textarea
              value={mission}
              onChange={(e) => {
                setMission(e.target.value);
                setSaved(false);
              }}
              rows={4}
              className="resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {busy ? t("saving") : t("save")}
          </button>
          {saved && <span className="text-xs font-medium text-accent2">{t("saved")}</span>}
        </div>
      </form>
    </div>
  );
}

// Rename + mission. Prefills from `listTopics` (owner-scoped, so it's available
// from both entry points without threading the mission through props). Seeds
// local state once, on first load, so typing isn't clobbered by the reactive
// query.
function DetailsSection({ topicSlug }: { topicSlug: string }) {
  const t = useTranslations("CourseSettings");
  const topics = useQuery(api.content.reader.listTopics);
  const renameTopic = useMutation(api.content.authoring.renameTopic);
  const editMission = useMutation(api.content.authoring.editMission);
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
      <h4 className="text-[0.8125rem] font-bold text-ink">{t("detailsHeading")}</h4>
      <p className="mt-1 text-[0.78rem] text-soft">{t("detailsBody")}</p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const tt = (title ?? "").trim();
          if (loading || !tt || !topic) return;
          setBusy(true);
          setSaved(false);
          try {
            if (tt !== topic.title) await renameTopic({ topicSlug, title: tt });
            if (mission.trim() !== (topic.mission ?? "")) await editMission({ topicSlug, mission: mission.trim() });
            setSaved(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.6875rem] font-bold uppercase tracking-label text-accent2">{t("titleLabel")}</label>
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
          <label className="text-[0.6875rem] font-bold uppercase tracking-label text-accent2">{t("missionLabel")}</label>
          <textarea
            value={mission}
            disabled={loading}
            onChange={(e) => {
              setMission(e.target.value);
              setSaved(false);
            }}
            rows={4}
            placeholder={t("missionPlaceholder")}
            className="resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-60"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || loading || !(title ?? "").trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {busy ? t("saving") : t("save")}
          </button>
          {saved && <span className="text-xs font-medium text-accent2">{t("saved")}</span>}
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
  const t = useTranslations("CourseSettings");
  const lessons = useQuery(api.content.reader.listLessons, { topicSlug });
  // Was a `finally` with no `catch`: a refused delete closed the confirm as if
  // the lesson had gone. The confirm now stays up and says why.
  const del = useMutationRun(useMutation(api.content.authoring.deleteLesson), t("updateError"));
  const [pending, setPending] = useState<{ key: string; title: string } | null>(null);
  const pendingName = pending ? pending.title.split("—")[0]!.trim() : "";

  return (
    <div>
      <h4 className="text-[0.8125rem] font-bold text-ink">{t("lessonsHeading")}</h4>
      <p className="mt-1 text-[0.78rem] text-soft">{t("lessonsBody")}</p>

      {lessons === undefined ? (
        <p className="mt-4 text-[0.78rem] text-soft">{t("loading")}</p>
      ) : lessons.length === 0 ? (
        <p className="mt-4 text-[0.78rem] text-soft">{t("noLessons")}</p>
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
                label={t("deleteLessonLabel", { title: l.title })}
                title={t("deleteLessonTitle")}
                onClick={() => setPending({ key: l.key, title: l.title })}
              />
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <ConfirmDialog
          title={t("deleteConfirmTitle")}
          body={t("deleteConfirmBody", { title: pendingName })}
          confirmLabel={del.busy ? t("deleting") : t("deleteLessonTitle")}
          confirmDisabled={del.busy}
          extra={del.error ? <p className="text-xs text-danger">{del.error}</p> : undefined}
          onConfirm={() => {
            void del.run({ topicSlug, key: pending.key }).then((r) => {
              if (r !== undefined) setPending(null);
            });
          }}
          onClose={() => {
            del.reset();
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

// Course lifecycle (ADR 0015). "Mark complete" ends authoring behind a confirm
// (it stops the Routine); "Reopen" returns a completed course to active.
function CompletionSection({ topicSlug, status }: { topicSlug: string; status: "seeded" | "active" | "completed" }) {
  const t = useTranslations("CourseSettings");
  // Ending was a `finally` with no `catch` too: a refused "mark complete" closed
  // the confirm as if the course had ended. The confirm now stays up and says why.
  const end = useMutationRun(useMutation(api.content.authoring.endCourse), t("updateError"));
  const [confirming, setConfirming] = useState(false);
  // Reopening was a `finally` with no `catch`. Ticket 32.
  const reopen = useMutationRun(useMutation(api.content.authoring.reopenCourse), t("updateError"));

  if (status === "completed") {
    return (
      <div>
        <h4 className="text-[0.8125rem] font-bold text-ink">{t("completionHeading")}</h4>
        <p className="mt-1 text-[0.78rem] text-soft">{t("completionDoneBody")}</p>
        <button
          type="button"
          disabled={reopen.busy}
          onClick={() => void reopen.run({ topicSlug })}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:border-transparent hover:bg-hi hover:text-accent disabled:opacity-60"
        >
          <Icon name="refresh" className="h-4 w-4" /> {reopen.busy ? t("reopening") : t("reopen")}
        </button>
        {reopen.error && <p className="mt-2 text-xs text-danger">{reopen.error}</p>}
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-[0.8125rem] font-bold text-ink">{t("completionHeading")}</h4>
      <p className="mt-1 text-[0.78rem] text-soft">{t("completionActiveBody")}</p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
        <span className="text-sm text-ink">{t("markCompleteRow")}</span>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
        >
          <Icon name="check" className="h-4 w-4" /> {t("markComplete")}
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t("markCompleteConfirmTitle")}
          body={t("markCompleteConfirmBody")}
          confirmLabel={end.busy ? t("ending") : t("markComplete")}
          confirmDisabled={end.busy}
          extra={end.error ? <p className="text-xs text-danger">{end.error}</p> : undefined}
          onConfirm={() => {
            void end.run({ topicSlug }).then((r) => {
              if (r !== undefined) setConfirming(false);
            });
          }}
          onClose={() => {
            end.reset();
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}

// Delete this course (authoring/03, decided 2026-09-21). The last thing in
// Course settings, because it is the one control here that cannot be undone.
//
// Two states, both driven by the server's own guard (`courseDeleteHolders`, the
// same counts `deleteTopic` re-derives before it deletes anything): the button is
// live only for a course nobody else holds, and otherwise it is disabled with the
// holders named, so "why can't I delete this" is answered on the page rather than
// in an error. The server refusal is the real boundary; this only saves a trip.
function DeleteSection({ topicSlug }: { topicSlug: string }) {
  const t = useTranslations("CourseSettings");
  const router = useRouter();
  const holders = useQuery(api.content.authoring.courseDeleteHolders, { topicSlug });
  const title = useQuery(api.content.reader.courseHeader, { topicSlug })?.title ?? "";
  const del = useMutationRun(useMutation(api.content.authoring.deleteTopic), t("updateError"));
  const [confirming, setConfirming] = useState(false);
  // Type-to-confirm. Every other confirm in this file guards something reversible
  // (a lesson can be re-authored, a completed course reopened); this one ends a
  // course and its whole history, so it asks for the name rather than a click.
  const [typed, setTyped] = useState("");

  // The holders that are actually non-zero, as the label the owner must act on.
  const blocking = Object.entries(holders ?? {}).filter(([, n]) => n > 0);

  return (
    <div>
      <h4 className="text-[0.8125rem] font-bold text-ink">{t("deleteHeading")}</h4>
      <p className="mt-1 text-[0.78rem] text-soft">{t("deleteBody")}</p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
        <span className="text-sm text-ink">{t("deleteRow")}</span>
        <button
          type="button"
          disabled={holders === undefined || blocking.length > 0}
          onClick={() => setConfirming(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
        >
          <Icon name="trash" className="h-4 w-4" /> {t("deleteCourse")}
        </button>
      </div>
      {blocking.length > 0 && (
        <p className="mt-2 text-xs text-soft">
          {t("deleteBlocked")}{" "}
          {blocking.map(([k, n]) => t(`deleteHolder_${k}` as "deleteHolder_buyers", { count: n })).join(", ")}
        </p>
      )}
      {del.error && <p className="mt-2 text-xs text-danger">{del.error}</p>}
      {confirming && (
        <ConfirmDialog
          title={t("deleteConfirmCourseTitle")}
          body={t("deleteConfirmCourseBody", { title })}
          confirmLabel={del.busy ? t("deleting") : t("deleteCourse")}
          confirmDisabled={del.busy || typed.trim() !== title.trim()}
          extra={
            <>
              <label className="block text-xs text-soft">{t("deleteTypeToConfirm", { title })}</label>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-danger focus:outline-none"
              />
              {del.error && <p className="mt-2 text-xs text-danger">{del.error}</p>}
            </>
          }
          onConfirm={() => {
            void del.run({ topicSlug }).then((r) => {
              // The course is gone, and so is every query this page is built on,
              // so leave before the subscriptions resolve to nothing.
              if (r !== undefined) router.replace("/");
            });
          }}
          onClose={() => {
            del.reset();
            setTyped("");
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
