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
          <CertificateCard {...certificate} />
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
