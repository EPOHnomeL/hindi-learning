"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { CertificateChip } from "./Certificate";
import { Icon } from "./icons";
import { IconButton } from "./ui";

// The two pieces every openable course card on the dashboard is built from
// (2026-09-08, prototype variant A, walked in the browser before it was written).
//
// THE CARD BODY IS THE LINK. There is no "Open course" button any more: clicking
// anywhere on the card opens the course, and the foot carries a quiet cue saying
// so. That leaves the card's own actions, the certificate and the door to manage,
// as the only buttons on it, so a learner who has just finished a course sees the
// thing they earned instead of hunting for it in a kebab.
//
// The click target is `CardTitleLink`: a REAL anchor on the course title whose
// `::after` is stretched over the whole card. Not an onClick on the <article>,
// which throws away the three things a learner actually uses on a library screen
// (middle click and cmd click for a new tab, right click to copy the link, and
// keyboard reachability), and not an <a> wrapped around the card either, which
// cannot legally contain the certificate and manage links. One tab stop per card,
// and its accessible name is the course title rather than the sixth identical
// "Open course" in the tab order, which is why the foot cue is aria-hidden.
//
// The pointer-dependent half of the affordance (quiet-until-hover only where
// hover exists, press feedback where it does not, the reduced-motion guard) lives
// in `.open-card` in globals.css, which the <article> wears. A card that cannot be
// opened, a seeded course still setting up or a course awaiting an EFT, wears
// neither that class nor these parts: it keeps a named button.

// The course title as the card's stretched link. `after:inset-0` covers the
// card, so the anchor is the whole card's hit area; the focus ring is drawn by
// that same overlay, which puts it around the CARD rather than around the title's
// text box. The card must be `relative` for the overlay to resolve against it.
//
// `focus-visible:outline-none` on the anchor kills only the anchor's OWN ring, not
// the overlay's: Tailwind registers `--tw-outline-style` with `inherits: false`, so
// the ::after resolves it to its initial `solid` rather than to the `none` set on
// the anchor (checked against the compiled CSS, not assumed).
export function CardTitleLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  // Extra classes for the heading (the owned card tracks its own tracking).
  className?: string;
}) {
  return (
    <h2 className={`min-w-0 text-lg font-semibold leading-snug text-ink ${className ?? ""}`}>
      <Link
        href={href}
        className="after:absolute after:inset-0 after:z-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
      >
        {children}
      </Link>
    </h2>
  );
}

// The card's foot: the open cue on the left, the card's own actions on the right.
// The actions sit above the stretched overlay (`z-10`) so they stay separately
// clickable and separately tabbable; without that they would be under it, because
// a positioned overlay paints over ordinary content whatever the DOM order.
export function CardFoot({
  slug,
  manage = false,
  certificate = false,
}: {
  slug: string;
  // Owned courses only: the door to /courses/<slug>/manage.
  manage?: boolean;
  // Any card whose caller can hold a certificate for this course (owned, shared,
  // purchased). The chip self-hides until there is one to offer. Left off the
  // catalogue card, whose caller holds no Progress to earn one with.
  certificate?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const ted = useTranslations("Editions");

  return (
    <div className="mt-3.5 flex items-center justify-between gap-2">
      {/* Decorative: the title link is what announces this card to a screen
          reader. Named "Open course" for the eye, hidden from the tab order. */}
      <span
        aria-hidden
        className="open-card__cue inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent"
      >
        {t("openCourse")}
        <Icon name="arrow" className="open-card__arrow h-4 w-4" />
      </span>
      <span className="relative z-10 flex shrink-0 items-center gap-2">
        {certificate && <CertificateChip topicSlug={slug} />}
        {manage && <IconButton icon="sliders" label={ted("manageCourse")} href={`/courses/${slug}/manage`} />}
      </span>
    </div>
  );
}
