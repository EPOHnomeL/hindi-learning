"use client";

import { type FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { api } from "../../../../convex/_generated/api";
import { Icon, type IconName } from "../icons";
import { IconButton } from "../ui";

// Shared pieces of the manage route (ui-overhaul 16/19), split out so the shell
// and its tabs can import them without importing each other.

// One row of the owner's Editions panel, straight from api.translate.editions.
export type Edition = NonNullable<FunctionReturnType<typeof api.translate.editions>>["editions"][number];
// The translation engine for one Edition: `free` fires the cloud translate
// Routine (no token cost, slower); `gemini` schedules the paid in-Convex action.
export type Engine = Edition["engine"];

// An edition's inline markers: a "Source" badge for English, and a status dot
// (amber pulse = translating, red = failed, nothing = ready).
export function EditionBadges({ edition }: { edition: Edition }) {
  const t = useTranslations("Editions");
  return (
    <>
      {edition.source && (
        <span className="shrink-0 rounded-full bg-accent2/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-accent2">
          {t("sourceBadge")}
        </span>
      )}
      {edition.status === "translating" && (
        <span className="h-1.75 w-1.75 shrink-0 animate-pulse rounded-full bg-gold" title={t("translatingStatus")} aria-hidden />
      )}
      {edition.status === "failed" && (
        <span className="h-1.75 w-1.75 shrink-0 rounded-full bg-danger" title={t("failedStatus")} aria-hidden />
      )}
    </>
  );
}

// A native-<dialog> that sits as a bottom sheet on a phone and a centered
// dialog from `sm` up: the shell decision's one overlay, used for the edition
// list, add-a-language, and the turn-on-selling flow.
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/50 sm:m-auto sm:w-[92vw] sm:max-w-md sm:rounded-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="min-w-0 truncate text-sm font-semibold text-accent">{title}</h2>
        <IconButton icon="x" label={t("close")} variant="ghost" onClick={() => ref.current?.close()} />
      </div>
      <div className="max-h-[75dvh] overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}

// A layout-locked empty-state card, so error/placeholder states render at panel
// height instead of collapsing the column.
export function EmptyPanel({ icon, tone, message }: { icon: IconName; tone: "bad" | "soft"; message: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-card/30 p-8 text-center">
      <div
        className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
          tone === "bad" ? "bg-bad/15 text-danger" : "bg-hi text-soft"
        }`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="max-w-xs text-xs leading-relaxed text-soft">{message}</p>
    </div>
  );
}
