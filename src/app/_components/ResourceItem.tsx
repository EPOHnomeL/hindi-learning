"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "./MarkdownView";
import { resourceOpenMode } from "./readerDerive";

// One Resource in a reader sidebar. Shared by the authed reader (CourseShell) and
// the Guest reader (PublicReader) — both list the same row shape. A PDF or an
// external link opens in a new tab (the browser/site renders it natively); an
// uploaded Markdown file used to open there too, as a wall of raw text — instead
// it now opens in a styled in-app dialog rendered through our Markdown component.
type Resource = {
  id: string;
  filename: string;
  kind: "file" | "url";
  url: string | null;
  status?: string;
};

const rowClass =
  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-sm text-ink transition-colors hover:bg-hi md:py-1.5";

// A "processing"/"processed" status pill; hidden for the settled states.
function StatusTag({ status }: { status?: string }) {
  if (!status || status === "ready" || status === "raw") return null;
  return <span className="shrink-0 text-xs text-soft">{status}</span>;
}

export function ResourceItem({ resource }: { resource: Resource }) {
  const [open, setOpen] = useState(false);
  const { filename, kind, url, status } = resource;

  // No URL yet (blob still landing) — a static, non-clickable row.
  if (!url) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-soft">
        <span className="min-w-0 truncate">{filename}</span>
        <span className="shrink-0 text-xs">{status ?? ""}</span>
      </div>
    );
  }

  if (resourceOpenMode(filename, kind) === "dialog") {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={`w-full text-left ${rowClass}`}>
          <span className="min-w-0 truncate">
            <span aria-hidden className="mr-1 text-soft">📝</span>
            {filename}
          </span>
          <StatusTag status={status} />
        </button>
        {open && <MarkdownResourceDialog title={filename} url={url} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={rowClass}>
      <span className="min-w-0 truncate">
        <span aria-hidden className="mr-1 text-soft">{kind === "url" ? "🔗" : "📄"}</span>
        {filename}
      </span>
      <StatusTag status={status} />
    </a>
  );
}

// Renders an uploaded Markdown Resource in a modal (same native <dialog> idiom as
// the dashboard's MissionDialog — Esc, backdrop-click, and focus trap for free).
// The blob text is fetched from its signed storage URL; if that fails (offline,
// CORS), we fall back to opening the raw file directly.
export function MarkdownResourceDialog({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  const t = useTranslations("Resource");
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; text: string } | { status: "error" }
  >({ status: "loading" });

  useEffect(() => ref.current?.showModal(), []);
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => alive && setState({ status: "ready", text }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // click on the backdrop
      }}
      className="m-auto w-[92vw] max-w-2xl rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="min-w-0 truncate text-base font-semibold text-accent">{title}</h2>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={t("openRawFile")}
            className="rounded-lg px-2 py-1 text-xs text-soft transition-colors hover:bg-hi hover:text-accent"
          >
            {t("raw")} ↗
          </a>
          <button
            onClick={() => ref.current?.close()}
            aria-label={t("close")}
            className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
        {state.status === "loading" && <p className="text-sm text-soft">{t("loading")}</p>}
        {state.status === "error" && (
          <p className="text-sm text-soft">
            {t("loadFailed")}{" "}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent2 underline underline-offset-2">
              {t("openDirectly")} ↗
            </a>
          </p>
        )}
        {state.status === "ready" && <Markdown source={state.text} />}
      </div>
    </dialog>
  );
}
