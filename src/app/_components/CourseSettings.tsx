"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { EmblemSection } from "./Certificate";
import { Icon } from "./icons";
import { ConfirmDialog, Dialog, IconButton } from "./ui";

// The consolidated "Course settings" dialog (UI redesign): Details, the
// certificate emblem, and the completion lifecycle. Details follows a target
// Edition (`lang`): on a translated Edition it edits that Edition's title &
// mission (replacing the old title pencil); on the English source it edits the
// source. The dialog self-resolves the served Edition from `lang` via
// `courseHeader`, so a caller just passes a language.
//
// CORRECTED 2026-08-27 (ui-overhaul 17). This comment used to claim two entry
// points, the reader and the dashboard, and an Editor who "sees only Details".
// There is ONE caller: Dashboard.tsx, the owner's course-card kebab, and it never
// passes `owner`. So the `owner={false}` branch below, the Editor's Details-only
// view, is currently DEAD CODE: nothing renders it. Commit e228ba5 (2026-08-23)
// removed the reader's door when it trimmed the reader drawer to lessons,
// references and resources, and that commit message records the cost in its own
// words, "a translated Edition Editor loses the Details door".
//
// The branch is kept rather than deleted because ui-overhaul 17 decided the door
// returns in the reader, Details only, gated on the per-Edition `canEdit` that
// `courseHeader` already computes server side (ADR 0020). Ticket 20 revives it.
// Everything outside Details stays owner-only.
export function CourseSettingsDialog({
  topicSlug,
  status,
  onClose,
  owner = true,
  lang = null,
}: {
  topicSlug: string;
  status: "seeded" | "active" | "completed";
  onClose: () => void;
  owner?: boolean;
  lang?: string | null;
}) {
  const t = useTranslations("CourseSettings");
  return (
    <Dialog title={t("title")} onClose={onClose}>
      <CourseSettingsBody topicSlug={topicSlug} status={status} owner={owner} lang={lang} />
    </Dialog>
  );
}

// The dialog's interior, shared with the manage route's Course settings tab
// (ui-overhaul 19); ticket 20 redesigns it.
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
            <p className="text-[12.5px] text-soft">{t("loading")}</p>
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
          <div className="border-t border-line pt-5">
            <CompletionSection topicSlug={topicSlug} status={status} />
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
  const setTeacherQa = useMutation(api.capture.setTeacherQa);
  const [busy, setBusy] = useState(false);
  // Absence means ON, and so does a header still loading: the toggle must never
  // flash "off" on a course whose Q&A is open.
  const on = header?.teacherQa ?? true;

  return (
    <div>
      <h4 className="text-[13px] font-bold text-ink">{t("teacherQa")}</h4>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors ${
              on ? "bg-accent2/15 text-accent2" : "bg-hi text-soft"
            }`}
          >
            <Icon name="chat" className="h-4.5 w-4.5" />
          </span>
          <span className="text-[11.5px] text-soft">{on ? t("teacherQaOn") : t("teacherQaOff")}</span>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={on}
            disabled={busy || header === undefined}
            onChange={(e) => {
              setBusy(true);
              void setTeacherQa({ topicSlug, enabled: e.target.checked }).finally(() => setBusy(false));
            }}
            className="peer sr-only"
          />
          <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-accent2 ltr:peer-checked:after:translate-x-4.5 rtl:peer-checked:after:-translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
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
      <h4 className="text-[13px] font-bold text-ink">{t("editionDetailsHeading", { native })}</h4>
      <p className="mt-1 text-[12.5px] text-soft">{t("editionDetailsBody")}</p>
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
          <label className="text-[11px] font-bold uppercase tracking-wide text-accent2">{t("titleLabel")}</label>
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
            <label className="text-[11px] font-bold uppercase tracking-wide text-accent2">{t("missionLabel")}</label>
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
      <h4 className="text-[13px] font-bold text-ink">{t("detailsHeading")}</h4>
      <p className="mt-1 text-[12.5px] text-soft">{t("detailsBody")}</p>
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
          <label className="text-[11px] font-bold uppercase tracking-wide text-accent2">{t("titleLabel")}</label>
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
          <label className="text-[11px] font-bold uppercase tracking-wide text-accent2">{t("missionLabel")}</label>
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
  const deleteLesson = useMutation(api.content.authoring.deleteLesson);
  const [pending, setPending] = useState<{ key: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingName = pending ? pending.title.split("—")[0]!.trim() : "";

  return (
    <div>
      <h4 className="text-[13px] font-bold text-ink">{t("lessonsHeading")}</h4>
      <p className="mt-1 text-[12.5px] text-soft">{t("lessonsBody")}</p>

      {lessons === undefined ? (
        <p className="mt-4 text-[12.5px] text-soft">{t("loading")}</p>
      ) : lessons.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-soft">{t("noLessons")}</p>
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
          confirmLabel={busy ? t("deleting") : t("deleteLessonTitle")}
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
  const t = useTranslations("CourseSettings");
  const endCourse = useMutation(api.content.authoring.endCourse);
  const reopenCourse = useMutation(api.content.authoring.reopenCourse);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "completed") {
    return (
      <div>
        <h4 className="text-[13px] font-bold text-ink">{t("completionHeading")}</h4>
        <p className="mt-1 text-[12.5px] text-soft">{t("completionDoneBody")}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void reopenCourse({ topicSlug }).finally(() => setBusy(false));
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:border-transparent hover:bg-hi hover:text-accent disabled:opacity-60"
        >
          <Icon name="refresh" className="h-4 w-4" /> {busy ? t("reopening") : t("reopen")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-[13px] font-bold text-ink">{t("completionHeading")}</h4>
      <p className="mt-1 text-[12.5px] text-soft">{t("completionActiveBody")}</p>
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
          confirmLabel={busy ? t("ending") : t("markComplete")}
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
