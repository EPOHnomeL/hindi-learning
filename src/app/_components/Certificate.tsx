"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useEditionLang } from "./editionUrl";

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

// The shared inner content for both the plain view dialog and the celebration:
// the earned card + share actions, or the name form that claims. `certificate` is
// live from the caller's query, so the moment a claim lands this flips from form
// to card — the in-app dialog and the celebration can't drift apart.
function CertificateBody({ topicSlug, certificate }: { topicSlug: string; certificate: CertificateData | null }) {
  const claim = useMutation(api.certificates.claimCertificate);
  // The Edition the learner is reading (course-translation) — snapshot its title
  // onto the certificate, so a Viewer reading Spanish earns a Spanish-titled one.
  const lang = useEditionLang();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (certificate) {
    return (
      <div className="flex flex-col gap-4">
        <CertificateCard {...certificate} />
        {certificate.token && <CertificateLinkActions token={certificate.token} />}
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await claim({ topicSlug, name: name.trim(), lang: lang ?? undefined });
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <p className="text-xs text-soft">Leave blank to use your account name.</p>
      <button
        type="submit"
        disabled={busy}
        className="mt-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create certificate"}
      </button>
    </form>
  );
}

// The plain claim/view modal (from the persistent control). `certificate` is
// passed live from the control; while null and eligible it shows the name form,
// and the moment the claim lands the reactive query repopulates it and the same
// dialog flips to the earned card — no manual close/reopen.
function CertificateDialog({
  topicSlug,
  certificate,
  onClose,
}: {
  topicSlug: string;
  certificate: CertificateData | null;
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
      className="m-auto w-[92vw] max-w-lg rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 className="text-sm font-semibold text-accent">{certificate ? "Your certificate" : "Claim your certificate"}</h2>
        <button
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
        >
          ✕
        </button>
      </div>
      <div className="px-6 py-6">
        <CertificateBody topicSlug={topicSlug} certificate={certificate} />
      </div>
    </dialog>
  );
}

// localStorage marker so the celebration fires once per Certificate, per device
// — the same per-device pattern as the reader's seen-replies / Guest ticks.
const CELEBRATED_KEY = "hindi:cert-celebrated";

// One-shot confetti burst. Lazy-imported so it stays out of the public certificate
// page bundle, and skipped entirely under `prefers-reduced-motion` (canvas-confetti
// also honours it internally as a backstop).
function fireConfetti() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  void import("canvas-confetti").then(({ default: confetti }) => {
    confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
  });
}

// The completion celebration (ADR 0015): a one-shot confetti burst + a certificate
// card reveal, shown the first time a learner is newly eligible or just-earned on
// a completed course — for whoever becomes eligible (owner or Viewer), whenever
// they next load it, not only at the instant of "Mark complete". Wraps slice 2's
// claim flow (CertificateBody): the name field completes the claim, then the same
// dialog flips to the earned card + download/share CTA. Fires once per Certificate
// via a per-device localStorage marker, so revisiting a completed lesson doesn't
// re-trigger it; dismissing without claiming still leaves the persistent
// "Claim your certificate" control (CertificateControl) for later.
export function CompletionCelebration({ topicSlug }: { topicSlug: string }) {
  const data = useQuery(api.certificates.myCertificate, { topicSlug });
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !data) return;
    if (!data.certificate && !data.eligible) return; // not yet finished / no access
    let seen = false;
    try {
      seen = localStorage.getItem(`${CELEBRATED_KEY}:${topicSlug}`) === "1";
    } catch {
      /* storage unavailable — celebrate anyway, just don't persist suppression */
    }
    if (seen) return;
    firedRef.current = true;
    try {
      localStorage.setItem(`${CELEBRATED_KEY}:${topicSlug}`, "1");
    } catch {
      /* ignore */
    }
    setShow(true);
    fireConfetti();
  }, [data, topicSlug]);

  useEffect(() => {
    if (show) ref.current?.showModal();
  }, [show]);

  if (!show || !data) return null;
  const certificate = data.certificate;
  return (
    <dialog
      ref={ref}
      onClose={() => setShow(false)}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[92vw] max-w-lg rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-end px-3 py-2">
        <button
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
        >
          ✕
        </button>
      </div>
      <div className="cert-reveal px-6 pb-8 pt-1 text-center">
        <p className="text-4xl" aria-hidden>
          🎉
        </p>
        <h2 className="mt-2 text-xl font-semibold text-accent">
          {certificate ? "Your certificate is ready" : "You finished the course!"}
        </h2>
        <p className="mt-1 text-sm text-soft">
          {certificate
            ? "Keep it, download it as a PDF, or share the link."
            : "Add the name to print on your certificate."}
        </p>
        <div className="mt-5 text-left">
          <CertificateBody topicSlug={topicSlug} certificate={certificate} />
        </div>
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
      {/* Apply the Edition's direction so an RTL-titled certificate renders
          correctly (course-translation). */}
      <div className="w-full" dir={cert.dir}>
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
