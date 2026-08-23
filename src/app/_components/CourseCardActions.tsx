"use client";

import { useAction, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { CertificateControl } from "./Certificate";
import { withLang } from "./editionUrl";
import { Menu, MenuItem } from "./ui";

// The owned-course card's single action row (mobile bottom nav, 2026-08-23):
//
//   [ Open course ................ ] [ globe ] [ kebab ]
//
// The card had grown up to five tap targets in one row on a phone, including
// TWO visually identical kebabs side by side (the certificate menu and the
// admin menu), which is unreadable. This collapses to three: the primary
// action, the reading language, and one overflow holding everything else, with
// a dot when something inside wants attention.
//
// `CertificateControl` is reused rather than reimplemented: it already handles
// both states (view an earned certificate, claim an eligible one) and
// self-hides otherwise, so no claim mutation is duplicated here. It just gets
// menu-row styling via its className.
const MENU_ROW =
  "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-ink transition-colors hover:bg-hi hover:text-accent";

export function CourseCardActions({
  slug,
  title,
  openHref,
  openLabel,
  editions,
  courseCompleted,
  onOpenSettings,
  onOpenEditions,
}: {
  slug: string;
  title: string;
  openHref: string;
  openLabel: string;
  editions: { lang: string; native: string; rtl: boolean }[];
  // True once the course is `completed` (ADR 0015): authoring has stopped, so
  // the kebab never offers the admin's "Finish generating course" there.
  courseCompleted: boolean;
  onOpenSettings: () => void;
  onOpenEditions: () => void;
}) {
  const t = useTranslations("Dashboard");
  const tcs = useTranslations("CourseSettings");
  const ted = useTranslations("Editions");
  const cert = useQuery(api.certificates.myCertificate, { topicSlug: slug });
  const amAdmin = useQuery(api.whitelist.amIAdmin);
  const status = useQuery(api.routine.generationStatus, { topicSlug: slug });
  const finish = useAction(api.routine.finishGenerating);
  const cancel = useAction(api.routine.cancelFinishGenerating);
  const [busy, setBusy] = useState(false);

  const generating = busy || status?.status === "generating";
  const cancelling = status?.cancelRequested === true;
  const failed = status?.status === "failed";
  // Something in the overflow wants attention: an unclaimed certificate, or a
  // generation run that fell over.
  const dot = (!!cert && !cert.certificate && cert.eligible) || (failed && !courseCompleted);

  return (
    <div className="flex items-center gap-2">
      <Link
        href={openHref}
        className="flex-1 rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
      >
        {openLabel}
      </Link>

      {/* The reading language of THIS course (its Edition), which came off the
          lesson drawer. Per-course, so it cannot sit in Settings beside the app
          language. Only shown once a translation exists: one Edition is not a
          choice. */}
      {editions.length > 0 && (
        <Menu triggerIcon="globe" triggerLabel={t("readingLanguageFor", { title })}>
          {(close) => (
            <>
              <MenuItem icon="book" href={withLang(`/courses/${slug}`, "en")} onClick={close}>
                English
              </MenuItem>
              {editions.map((e) => (
                <MenuItem key={e.lang} icon="book" href={withLang(`/courses/${slug}`, e.lang)} onClick={close}>
                  {e.native}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      )}

      <Menu triggerLabel={t("moreActionsFor", { title })} dot={dot}>
        {(close) => (
          <>
            <CertificateControl topicSlug={slug} className={MENU_ROW} />
            <MenuItem
              icon="settings"
              onClick={() => {
                close();
                onOpenSettings();
              }}
            >
              {tcs("title")}
            </MenuItem>
            <MenuItem
              icon="globe"
              onClick={() => {
                close();
                onOpenEditions();
              }}
            >
              {ted("dialogTitle")}
            </MenuItem>
            {/* Admin "fire and pray": generate the remaining curriculum in one
                go. Self-gated; lives in this one kebab rather than beside it. */}
            {amAdmin &&
              !courseCompleted &&
              (generating ? (
                <MenuItem
                  icon="x"
                  onClick={() => {
                    close();
                    if (!cancelling) void cancel({ topicSlug: slug });
                  }}
                >
                  {cancelling ? t("cancelling") : t("cancelGeneration")}
                </MenuItem>
              ) : (
                <MenuItem
                  icon="refresh"
                  onClick={() => {
                    close();
                    setBusy(true);
                    void finish({ topicSlug: slug }).finally(() => setBusy(false));
                  }}
                >
                  {failed ? t("finishGeneratingRetry") : t("finishGenerating")}
                </MenuItem>
              ))}
          </>
        )}
      </Menu>
    </div>
  );
}
