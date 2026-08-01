"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "./icons";
import { useTenant } from "./TenantContext";
import { Dialog, IconButton } from "./ui";
import { missionExcerpt } from "./welcomeDerive";

// Has the reader already dismissed the welcome panel this session? Not component
// state: both readers remount on every route change (and again after sign-in), so a
// plain `useState(false)` re-opened the panel on every single lesson — the panel
// followed you around instead of greeting you once. sessionStorage, not local: a
// fresh tab is a fresh visit and still gets the orientation, but within one visit
// one dismissal is final. Starts `true` so nothing flashes before the read, and a
// blocked/absent sessionStorage just means "not dismissed" — the panel still works,
// it simply can't remember.
export function useWelcomeDismissed(scope: string): [boolean, () => void] {
  const key = `welcome:dismissed:${scope}`;
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);
  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore — dismissal holds for this mount either way */
    }
  }, [key]);
  return [dismissed, dismiss];
}

// The first-open welcome panel (welcome/01). Someone's first contact with a course
// is a lesson — they open one for the first time, or they arrive cold on a Public
// link — and the reader otherwise drops them straight into lesson content with no
// orientation. This says what the course is, how long it is, and which lesson to
// start on, plus a way back to the brand's front door.
//
// A modal, on the shared `Dialog` (user's call, 2026-07-28 — this reverses the
// scoping ticket's inline-card default). The ticket's objection to a modal was that
// it could trap a Guest behind a dialog on a page they were linked to; `Dialog` is
// the native `<dialog>`, so Esc, a backdrop click and the X all close it through one
// path, and the lesson is one dismissal away. Rendered by both readers (CourseShell
// and PublicReader) so the two stay in step.
// The purchase variant (ywampotch-launch 17) is this same panel with its opening
// line swapped: a card buyer back from PayFast is acknowledged HERE rather than by
// a second surface competing with it. `confirmed: false` is the in-flight ITN — the
// start CTA is withheld because the content isn't unlocked yet, and
// `market.checkoutStatus` is reactive, so it appears the moment the grant lands.
export function Welcome({
  course,
  lessonCount,
  mission,
  next,
  homeHref,
  onDismiss,
  purchase,
}: {
  course: string;
  lessonCount: number;
  mission: string | null;
  purchase?: { confirmed: boolean } | null;
  // The lesson to start on: `resumeLessonKey`'s target — lesson 1 for a genuinely
  // new reader, their next one if they carry progress. Null when the course has no
  // published lessons, and then there is nothing to offer.
  next: { seq: number; title: string; href: string } | null;
  // The tenant portal's front door (`tenantHomeHref`) — relative on the canonical
  // host, absolute when a Public link was opened off-host.
  homeHref: string;
  onDismiss: () => void;
}) {
  const t = useTranslations("Welcome");
  const brand = useTenant()?.displayName ?? "My Course";
  const excerpt = missionExcerpt(mission);
  // Nothing to start while the ITN is in flight — every lesson past the Preview is
  // still locked, and pointing at a door that won't open is worse than waiting.
  const start = purchase && !purchase.confirmed ? null : next;

  return (
    <Dialog onClose={onDismiss}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              purchase?.confirmed ? "bg-gold/20 text-gold" : "bg-hi text-accent"
            }`}
            aria-busy={purchase && !purchase.confirmed ? true : undefined}
          >
            {purchase ? (
              purchase.confirmed ? (
                <Icon name="check" className="h-5 w-5" />
              ) : (
                <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-gold" />
              )
            ) : (
              <Icon name="book" className="h-5 w-5" />
            )}
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent2">
              {t(purchase ? (purchase.confirmed ? "paidEyebrow" : "confirmingEyebrow") : "eyebrow")}
            </p>
            <h2 id="welcome-heading" className="text-lg font-semibold tracking-tight text-accent md:text-xl">
              {course}
            </h2>
            <p className="mt-0.5 text-xs text-soft">{t("lessonCount", { count: lessonCount })}</p>
          </div>
        </div>
        <IconButton icon="x" label={t("dismiss")} variant="ghost" onClick={onDismiss} />
      </div>

      {/* The purchase line stands in for the mission excerpt rather than sitting
          above it: a buyer who has just paid is owed one clear sentence, not a
          receipt followed by a course blurb. */}
      {purchase ? (
        <p className="mt-4 text-sm leading-relaxed text-ink">
          {t(purchase.confirmed ? "paidBody" : "confirmingBody")}
        </p>
      ) : (
        excerpt && <p className="mt-4 text-sm leading-relaxed text-ink">{excerpt}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        {start && (
          <Link
            href={start.href}
            onClick={onDismiss}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
          >
            {t("start", { seq: start.seq })}
            <Icon name="chevron" className="h-4 w-4 -rotate-90" />
          </Link>
        )}
        <Link href={homeHref} className="text-sm text-soft underline-offset-2 hover:text-accent hover:underline">
          {t("home", { brand })}
        </Link>
      </div>

      {start && <p className="mt-2 text-xs text-soft">{start.title}</p>}
    </Dialog>
  );
}
