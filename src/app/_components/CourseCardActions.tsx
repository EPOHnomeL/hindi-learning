"use client";

import { useAction, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { CertificateControl } from "./Certificate";
import { IconButton, Menu, MenuItem } from "./ui";

// The owned-course card's single action row (mobile bottom nav, 2026-08-23):
//
//   [ Open course ................ ] [ globe ] [ kebab ]
//
// The card had grown up to five tap targets in one row on a phone, including
// TWO visually identical kebabs side by side (the certificate menu and the
// admin menu), which is unreadable. This collapses to three: the primary
// action, Editions & sharing, and one overflow holding everything else, with a
// dot when something inside wants attention. The globe opened a reading-language
// menu until 2026-08-25; it now opens the Editions & sharing dialog directly,
// which is where a learner picks a language now that the home screen has no
// global language select.
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
  courseCompleted,
  onOpenSettings,
  onOpenEditions,
}: {
  slug: string;
  title: string;
  openHref: string;
  openLabel: string;
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

      {/* One tap beside "Open course" opens Editions & sharing, the dialog that
          owns this course's languages and who they are shared with (2026-08-25).
          It used to drop a menu listing the Editions, but the home screen no
          longer carries a global language select, so the dialog itself is the
          destination rather than a second stop on the way. */}
      <IconButton
        icon="globe"
        label={ted("dialogTitle")}
        ariaHasPopup="dialog"
        onClick={onOpenEditions}
      />

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
