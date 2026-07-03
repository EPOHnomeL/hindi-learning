"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";

export type CertificateData = {
  learnerName: string;
  courseTitle: string;
  lessonCount: number;
  issuedAt: number;
  token?: string;
};

// The visual Certificate — a self-contained card, reused in-app (the claim/view
// dialog below) and, in slice 3, on the anonymous /certificate/[token] page and
// its print-to-PDF. Presentational only; no data fetching, so the in-app and
// public views can't drift. Brand: "My Course".
export function CertificateCard({ learnerName, courseTitle, lessonCount, issuedAt }: CertificateData) {
  const date = new Date(issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="cert-card relative overflow-hidden rounded-2xl border-2 border-gold/60 bg-card px-8 py-10 text-center shadow-sm">
      <div className="pointer-events-none absolute inset-2 rounded-xl border border-gold/30" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent2">Certificate of Completion</p>
      <p className="mt-6 text-sm text-soft">This certifies that</p>
      <p className="mt-1 text-2xl font-semibold text-accent">{learnerName}</p>
      <p className="mt-4 text-sm text-soft">has completed the course</p>
      <p className="mt-1 text-xl font-semibold text-ink">{courseTitle}</p>
      <p className="mt-6 text-sm text-soft">
        {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"} · {date}
      </p>
      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent2">My Course</p>
    </div>
  );
}

// The reader/dashboard affordance for a completed course. Shows "Claim your
// certificate" when the caller is eligible, "View your certificate" once earned,
// and nothing otherwise (no access, or lessons still unfinished). Opens a dialog
// that either claims (name → mint) or displays the earned Certificate. Owner and
// Viewer alike — myCertificate is owner-or-Viewer gated server-side.
export function CertificateControl({ topicSlug, className }: { topicSlug: string; className?: string }) {
  const data = useQuery(api.certificates.myCertificate, { topicSlug });
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const { certificate, eligible } = data;
  if (!certificate && !eligible) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-lg bg-gold/20 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-gold/30"
        }
      >
        🎓 {certificate ? "View your certificate" : "Claim your certificate"}
      </button>
      {open && <CertificateDialog topicSlug={topicSlug} certificate={certificate} onClose={() => setOpen(false)} />}
    </>
  );
}

// The public Certificate link (ADR 0015) + a jump to the printable page. The
// link is always-on in v1 (low-sensitivity content), so there's no on/off toggle
// here — just copy and open. `rel="noreferrer"` keeps the token out of the
// Referer header, matching the Public-link posture.
function CertificateLinkActions({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/certificate/${token}`;
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Share this certificate</label>
      <div className="flex gap-1">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-line bg-hi px-2 py-1.5 text-xs text-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(url).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => {
                /* clipboard blocked — the field is selectable to copy by hand */
              },
            );
          }}
          className="shrink-0 rounded-lg bg-accent2 px-3 py-1.5 text-xs font-medium text-white"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <a href={url} target="_blank" rel="noreferrer" className="text-center text-xs text-soft transition-colors hover:text-accent">
        Open the public page to download a PDF →
      </a>
    </div>
  );
}

// The claim/view modal. `certificate` is passed live from the control (one
// subscription): while null and eligible it shows the name form; the moment the
// claim lands, the reactive query repopulates it and the same dialog flips to the
// earned card — no manual close/reopen.
function CertificateDialog({
  topicSlug,
  certificate,
  onClose,
}: {
  topicSlug: string;
  certificate: CertificateData | null;
  onClose: () => void;
}) {
  const claim = useMutation(api.certificates.claimCertificate);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[92vw] max-w-lg rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-end border-b border-line px-3 py-2">
        <button
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
        >
          ✕
        </button>
      </div>
      <div className="px-6 py-6">
        {certificate ? (
          <div className="flex flex-col gap-4">
            <CertificateCard {...certificate} />
            {certificate.token && <CertificateLinkActions token={certificate.token} />}
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await claim({ topicSlug, name: name.trim() });
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2 className="text-lg font-semibold text-accent">Claim your certificate</h2>
            <p className="text-sm text-soft">
              You’ve finished this course. Enter the name to print on your certificate (leave blank to use your account
              name).
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create certificate"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}

// The anonymous /certificate/[token] page (ADR 0015): renders the earned
// Certificate from the token-only publicCertificate query — no account needed.
// Reuses CertificateCard so the public and in-app views can't drift. "Download"
// prints to PDF via the browser (the print stylesheet strips the chrome). A
// missing/invalid token gets a uniform not-found — no existence signal.
export function PublicCertificatePage({ token }: { token: string }) {
  const cert = useQuery(api.certificates.publicCertificate, { token });
  if (cert === undefined) {
    return <main className="flex min-h-dvh items-center justify-center p-8 text-sm text-soft">Loading…</main>;
  }
  if (cert === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-3xl" aria-hidden>
          🎓
        </span>
        <h1 className="text-lg font-semibold text-accent">Certificate not found</h1>
        <p className="max-w-sm text-sm text-soft">This certificate link isn’t available.</p>
      </main>
    );
  }
  return (
    <main className="cert-print-page mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="w-full">
        <CertificateCard {...cert} />
      </div>
      <button
        onClick={() => window.print()}
        className="no-print rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
      >
        Download PDF
      </button>
    </main>
  );
}
