"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// Shared presentation primitives for the redesigned owner surfaces (UI redesign):
// an icon-only button, a reusable native-<dialog> wrapper, a click-outside popover
// menu, and the destructive-action confirm. These replace boilerplate that was
// duplicated across Dashboard / CourseShell / Certificate.

// An icon-only button. The visible chip is 38px (matching the design), but the
// tap target is padded out to ≥44px via a transparent `::after` overlay so it
// clears the touch-target minimum without disturbing layout. `label` is required
// and becomes both the accessible name and the tooltip. `dot` paints a small gold
// badge (e.g. an unclaimed certificate waiting in the menu).
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "default",
  dot,
  className,
  title,
  ariaHasPopup,
  ariaExpanded,
  href,
}: {
  icon: IconName;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "default" | "ghost";
  dot?: boolean;
  className?: string;
  title?: string;
  ariaHasPopup?: "menu" | "dialog" | true;
  ariaExpanded?: boolean;
  // Renders a Link instead of a button (e.g. the manage route's back arrow, or
  // the course card's door to /manage). Same chip, real navigation.
  href?: string;
}) {
  const cls = `relative inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border text-soft transition-colors after:absolute after:-inset-[3px] after:content-[''] hover:border-transparent hover:bg-hi hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-soft ${
    variant === "ghost" ? "border-transparent" : "border-line"
  } ${className ?? ""}`;
  const body = (
    <>
      <Icon name={icon} />
      {dot && <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-gold ring-2 ring-card" aria-hidden />}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} title={title ?? label} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      className={cls}
    >
      {body}
    </button>
  );
}

// One reusable modal built on the native <dialog>, so Esc-to-close, the backdrop,
// and focus trapping come for free. Renders a titled header (with a close button)
// above the body; pass a wider `className` (e.g. "max-w-2xl") when the content
// needs more room. Closing goes through the element's own `close()`, which fires
// the `close` event → `onClose` (the caller unmounts), so backdrop click, Esc, and
// the X all funnel through one path.
export function Dialog({
  title,
  onClose,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const t = useTranslations("Common");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // backdrop click
      }}
      className={`m-auto w-[92vw] ${className ?? "max-w-lg"} rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/50`}
    >
      {title !== undefined && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="min-w-0 truncate text-sm font-semibold text-accent">{title}</h2>
          <IconButton icon="x" label={t("close")} variant="ghost" onClick={() => ref.current?.close()} />
        </div>
      )}
      <div className={bodyClassName ?? "max-h-[80vh] overflow-y-auto px-6 py-5"}>{children}</div>
    </dialog>
  );
}

// A popover menu anchored to an icon-only trigger. Closes on click-outside and
// Esc. `children` is a render-prop given a `close` callback so items can dismiss
// the menu after acting. Used for the course card's ⋯ overflow (certificate).
export function Menu({
  triggerIcon = "kebab",
  triggerLabel,
  dot,
  children,
}: {
  triggerIcon?: IconName;
  triggerLabel: string;
  dot?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton
        icon={triggerIcon}
        label={triggerLabel}
        dot={dot}
        ariaHasPopup="menu"
        ariaExpanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div
          role="menu"
          className="pop-in absolute end-0 top-[calc(100%+6px)] z-50 min-w-[216px] rounded-xl border border-line bg-card p-1.5 shadow-xl"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// One row in a Menu. Renders as a link when `href` is set (e.g. "View
// certificate" opening the public page in a new tab), otherwise a button. The
// leading icon is muted by default and follows the row's accent on hover;
// `iconTone="gold"` keeps it gold (the certificate mark).
export function MenuItem({
  icon,
  iconTone,
  trailingIcon,
  children,
  onClick,
  href,
  target,
  rel,
}: {
  icon?: IconName;
  iconTone?: "gold";
  trailingIcon?: IconName;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
}) {
  const cls =
    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-start text-sm text-ink transition-colors hover:bg-hi hover:text-accent";
  const body = (
    <>
      {icon && (
        <Icon
          name={icon}
          className={`h-[17px] w-[17px] shrink-0 ${iconTone === "gold" ? "text-gold" : "text-soft group-hover:text-accent"}`}
        />
      )}
      <span className="min-w-0 flex-1">{children}</span>
      {trailingIcon && <Icon name={trailingIcon} className="h-[15px] w-[15px] shrink-0 text-soft group-hover:text-accent" />}
    </>
  );
  if (href) {
    return (
      <a role="menuitem" href={href} target={target} rel={rel} onClick={onClick} className={cls}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

// Skeleton shapes read as placeholders only if they contrast the paper — `bg-card`
// is near-white and vanishes. All placeholder fills use `bg-soft/20`, a muted grey
// that lifts off paper in both themes; card placeholders add `border border-line`.

// Loading placeholder for the lesson/reference reader body. Mirrors the content
// region those readers render (a centred reading column — title bar + body lines
// — plus a desktop-only question aside for lessons) so content fills in place
// instead of the page jumping from a bare "Loading…" line. Content only — the
// surrounding sidebar belongs to CourseShell / PublicCourseShell, which are
// already mounted where this renders. References have no question column, so
// pass `aside={false}`.
export function ReaderSkeleton({ aside = true }: { aside?: boolean }) {
  // Ragged widths so the body reads like paragraphs rather than a solid block.
  const lines = ["w-11/12", "w-full", "w-4/5", "w-full", "w-3/4", "w-11/12", "w-2/3"];
  return (
    <div className="flex flex-col flex-1 gap-4 md:h-full md:flex-row">
      {/* Centred reading column, mirroring the lesson body's centred measure. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Title + actions bar skeleton */}
        <div className="flex items-center justify-between border-b border-line bg-paper px-3 py-2 md:border-0 md:bg-transparent md:px-0 md:py-0">
          <div className="h-7 w-1/3 animate-pulse rounded-lg bg-soft/20" />
          <div className="h-8 w-24 animate-pulse rounded-lg bg-soft/20" />
        </div>
        {/* Card shell mimicking the iframe */}
        <div className="w-full flex-1 border-y border-line bg-card p-6 md:rounded-xl md:border md:p-10 mt-3 md:mt-4">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {/* Body lines */}
            <div className="flex flex-col gap-3">
              {lines.map((w, i) => (
                <div key={i} className={`h-4 ${w} animate-pulse rounded bg-soft/20`} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Desktop question aside — lessons only */}
      {aside && (
        <aside className="hidden shrink-0 md:block md:w-80">
          <div className="h-64 animate-pulse rounded-xl border border-line bg-soft/20" />
        </aside>
      )}
    </div>
  );
}

// The course sidebar placeholder (Lessons list), matching CourseShell's rail.
// Used only inside CourseSkeleton — where the real shell hasn't mounted yet.
function SidebarSkeleton() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-2 border-e border-line bg-paper p-4 md:flex">
      <div className="h-6 w-28 animate-pulse rounded bg-soft/20" />
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-soft/20" />
        ))}
      </div>
    </aside>
  );
}

// Whole course-view placeholder: the sidebar rail + a reader body. For loads that
// happen BEFORE the shell mounts its own sidebar (the public share course load,
// or the auth gate on a /courses/* deep link). Mirrors CourseShell's outer frame.
export function CourseSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col md:h-screen md:flex-row md:overflow-hidden">
      <SidebarSkeleton />
      <section className="min-w-0 flex-1 md:overflow-hidden md:p-4">
        <ReaderSkeleton />
      </section>
    </div>
  );
}

// The dashboard placeholder (header + course-card grid). Shown by the auth gate
// while the session resolves, since the dashboard is the home landing. Mirrors
// Dashboard's container, header, and grid.
export function DashboardSkeleton() {
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-soft/20" />
        <div className="flex flex-col gap-2">
          <div className="h-7 w-40 animate-pulse rounded bg-soft/20" />
          <div className="h-4 w-32 animate-pulse rounded bg-soft/20" />
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-soft/20" />
        ))}
      </div>
    </div>
  );
}

// A native-<dialog> yes/no confirm for destructive actions (e.g. "Mark course
// complete"). Shared by CourseShell and the course settings dialog.
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Common");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[92vw] max-w-md rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="px-6 py-5">
        <h2 className="text-base font-semibold text-accent">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-soft">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => ref.current?.close()} className="rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hi">
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
