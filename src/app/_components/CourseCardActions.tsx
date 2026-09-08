"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { CertificateChip } from "./Certificate";
import { IconButton } from "./ui";

// The owned-course card's single action row:
//
//   [ Open course ................ ] [ award ] [ sliders ]
//
// Three named targets, no overflow menu (2026-09-08). The kebab it replaces held
// three unrelated things: the certificate, Course settings and the admin's
// "Finish generating course". The certificate is now its own chip, so the one
// reward the learner earned is not hidden behind a glyph that names nothing;
// Course settings and the admin control both moved to the manage route, where
// every other course-wide setting already lives (the Course settings tab). One
// home for settings, and nothing left for a menu to hold.
export function CourseCardActions({
  slug,
  openHref,
  openLabel,
}: {
  slug: string;
  openHref: string;
  openLabel: string;
}) {
  const ted = useTranslations("Editions");

  return (
    <div className="flex items-center gap-2">
      <Link
        href={openHref}
        className="flex-1 rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
      >
        {openLabel}
      </Link>

      <CertificateChip topicSlug={slug} />

      {/* One tap beside "Open course" goes to the manage route (ui-overhaul 16),
          which replaced the Editions & sharing dialog on 2026-08-27. */}
      <IconButton icon="sliders" label={ted("manageCourse")} href={`/courses/${slug}/manage`} />
    </div>
  );
}
