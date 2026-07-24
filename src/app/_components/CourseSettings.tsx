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
// `courseHeader`, so both entry points just pass a language: the reader passes
// the Edition being read; the dashboard passes the UI-locale Edition when the
// course has it (else English). An Edition's Editor may open the dialog too but
// sees only Details — everything else stays owner-only (`owner`).
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
    <Dialog title={t("title")} onClose={onClose}>
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
    </Dialog>
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
