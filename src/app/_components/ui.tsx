"use client";

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
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      className={`relative inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border text-soft transition-colors after:absolute after:-inset-[3px] after:content-[''] hover:border-transparent hover:bg-hi hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-soft ${
        variant === "ghost" ? "border-transparent" : "border-line"
      } ${className ?? ""}`}
    >
      <Icon name={icon} />
      {dot && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold ring-2 ring-card" aria-hidden />}
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
          <IconButton icon="x" label="Close" variant="ghost" onClick={() => ref.current?.close()} />
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
          className="pop-in absolute right-0 top-[calc(100%+6px)] z-50 min-w-[216px] rounded-xl border border-line bg-card p-1.5 shadow-xl"
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
    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-ink transition-colors hover:bg-hi hover:text-accent";
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
            Cancel
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
