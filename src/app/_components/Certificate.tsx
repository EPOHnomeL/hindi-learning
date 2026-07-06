"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// The resolved Emblem (ADR 0017) as the read seams return it — an image resolves
// to a same-origin URL, otherwise a glyph (a subject emoji or the generic default).
export type CertificateEmblem = { kind: "image"; url: string } | { kind: "glyph"; glyph: string };

export type CertificateData = {
  learnerName: string;
  courseTitle: string;
  lessonCount: number;
  issuedAt: number;
  emblem: CertificateEmblem;
  token?: string;
  // The larger, more theatrical treatment for the standalone public page (vs. the
  // compact in-app dialogs). Presentational only.
  showcase?: boolean;
};

// The Emblem itself, inside the card's medallion. An image is raster-only and
// served same-origin (ADR 0017), so a plain <img> is safe and prints predictably;
// a glyph is inert text. Decorative — the achievement is spelled out below it — so
// it carries no alt text. `large` scales the glyph up for the showcase view.
function EmblemMark({ emblem, large }: { emblem: CertificateEmblem; large?: boolean }) {
  if (emblem.kind === "image") {
    return <img src={emblem.url} alt="" className="cert-emblem-img h-full w-full rounded-full object-cover" />;
  }
  return (
    <span className={`cert-emblem-glyph leading-none ${large ? "text-5xl sm:text-6xl" : "text-4xl"}`} aria-hidden>
      {emblem.glyph}
    </span>
  );
}

// A pointer-tracked tilt + spotlight for the card (ADR 0017). Sets CSS custom
// properties directly on the element (no React state → no re-render), and the CSS
// gates the visual off under prefers-reduced-motion / print — but we also bail out
// of the JS under reduced-motion so nothing moves at all.
const TILT_MAX_DEG = 7;
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
function onCardMove(e: React.MouseEvent<HTMLDivElement>) {
  if (prefersReducedMotion()) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width; // 0 (left) → 1 (right)
  const py = (e.clientY - r.top) / r.height; // 0 (top) → 1 (bottom)
  el.style.setProperty("--rx", `${(px - 0.5) * 2 * TILT_MAX_DEG}deg`);
  el.style.setProperty("--ry", `${(0.5 - py) * 2 * TILT_MAX_DEG}deg`);
  el.style.setProperty("--mx", `${px * 100}%`);
  el.style.setProperty("--my", `${py * 100}%`);
  el.style.setProperty("--glow-o", "1");
}
function onCardLeave(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
  el.style.setProperty("--glow-o", "0");
}

// The visual Certificate — a self-contained card, reused in-app (the claim/view
// dialog below), on the completion celebration, and on the anonymous
// /certificate/[token] page (with its print-to-PDF). Presentational only; no data
// fetching, so the surfaces can't drift. Carries the subject's Emblem in a metallic
// medallion, a holographic foil sheen, and a pointer tilt/spotlight (ADR 0017) —
// all CSS (globals.css `.cert-*`), degrading to a flat engraved document under
// print + reduced-motion. `showcase` (the public page) makes it larger and more
// theatrical — a warm outer glow, a stronger foil, and an ambient shine sweep —
// while the compact dialogs stay compact. Brand: "My Course".
export function CertificateCard({ learnerName, courseTitle, lessonCount, issuedAt, emblem, showcase }: CertificateData) {
  const date = new Date(issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const pad = showcase ? "px-10 py-14 sm:px-14 sm:py-16" : "px-8 py-10";
  const medallion = showcase ? "h-24 w-24 sm:h-28 sm:w-28" : "h-20 w-20";
  const nameSize = showcase ? "text-3xl sm:text-4xl" : "text-2xl";
  const titleSize = showcase ? "text-2xl sm:text-3xl" : "text-xl";
  return (
    <div
      className={`cert-card relative isolate overflow-hidden rounded-2xl border-2 border-gold/60 bg-card text-center shadow-sm ${pad} ${
        showcase ? "cert-card--showcase" : ""
      }`}
      onMouseMove={onCardMove}
      onMouseLeave={onCardLeave}
    >
      <div className="cert-sheen pointer-events-none absolute inset-0" aria-hidden />
      <div className="cert-glow pointer-events-none absolute inset-0" aria-hidden />
      {showcase && <div className="cert-shine pointer-events-none absolute inset-0" aria-hidden />}
      <div className="pointer-events-none absolute inset-2 rounded-xl border border-gold/30" aria-hidden />
      <div className="relative z-10">
        <div
          className={`cert-medallion mx-auto mb-5 flex items-center justify-center overflow-hidden rounded-full border-2 border-gold/70 ${medallion}`}
        >
          <EmblemMark emblem={emblem} large={showcase} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent2">Certificate of Completion</p>
        <p className="mt-6 text-sm text-soft">This certifies that</p>
        <p className={`mt-1 font-semibold text-accent ${nameSize}`}>{learnerName}</p>
        <p className="mt-4 text-sm text-soft">has completed the course</p>
        <p className={`mt-1 font-semibold text-ink ${titleSize}`}>{courseTitle}</p>
        <p className="mt-6 text-sm text-soft">
          {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"} · {date}
        </p>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent2">My Course</p>
      </div>
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

  const btnClass =
    className ??
    "rounded-lg bg-gold/20 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-gold/30";

  // Earned: "View" opens the standalone public certificate page in a new tab —
  // the shareable, printable surface — rather than an in-app dialog. Eligible but
  // not yet earned: open the claim dialog.
  if (certificate) {
    return (
      <button
        onClick={() => window.open(`/certificate/${certificate.token}`, "_blank", "noopener,noreferrer")}
        className={btnClass}
      >
        🎓 View your certificate
      </button>
    );
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className={btnClass}>
        🎓 Claim your certificate
      </button>
      {open && <CertificateDialog topicSlug={topicSlug} certificate={null} onClose={() => setOpen(false)} />}
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
          await claim({ topicSlug, name: name.trim() });
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

// Pull the human-readable tail out of a Convex server error (e.g. "…Uncaught
// Error: emblem must be a PNG, JPEG, or WebP image"), falling back to a generic
// line when the shape is unfamiliar.
function errorText(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : String(e);
  const marker = "Uncaught Error: ";
  const i = m.lastIndexOf(marker);
  return i >= 0 ? m.slice(i + marker.length).split("\n")[0]!.trim() : fallback;
}

// Downscale an owner-uploaded image to a small square raster before upload. The
// backend caps Emblem images at 256KB (ADR 0017) and a phone photo or screenshot
// is far larger — the teach CLI normalises server-side, but an owner uploading
// from the browser needs the same treatment here or the upload is refused. Draws
// a centre-cropped 256px square (cover) onto a canvas and encodes WebP (an allowed
// type, and comfortably under the cap). Returns the encoded blob.
async function normaliseEmblemImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn’t process that image.");
  const scale = Math.max(SIZE / bitmap.width, SIZE / bitmap.height); // cover: fill the square
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("Couldn’t process that image.");
  return blob;
}

// Owner-only: curate the course's Emblem (ADR 0017, PRD stories 9-14) — set a
// glyph (emoji / short character) or upload an image. The image is resized
// client-side (normaliseEmblemImage) then uploaded via the standard Resource flow
// (generateUploadUrl → POST → record); the server validates it (raster,
// size-capped; a Viewer is refused regardless). An owner override wins over the AI
// default, so this is how an owner picks their own mark. Gated by `canWrite` at
// the call site.
export function EmblemControl({ topicSlug, className }: { topicSlug: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "mb-2 flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
        }
      >
        ✦ Set certificate emblem
      </button>
      {open && <EmblemDialog topicSlug={topicSlug} onClose={() => setOpen(false)} />}
    </>
  );
}

function EmblemDialog({ topicSlug, onClose }: { topicSlug: string; onClose: () => void }) {
  const setEmblem = useMutation(api.emblem.setTopicEmblem);
  const generateUploadUrl = useMutation(api.resources.generateUploadUrl);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);

  const [glyph, setGlyph] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The just-saved Emblem, shown as a confirming preview so the owner sees the
  // change land — it otherwise only surfaces on a future certificate, so the
  // dialog used to just close with no feedback. An image preview is a local object
  // URL of the resized blob, revoked when it's replaced or the dialog unmounts.
  const [saved, setSaved] = useState<{ kind: "glyph"; glyph: string } | { kind: "image"; url: string } | null>(null);
  useEffect(() => {
    return () => {
      if (saved?.kind === "image") URL.revokeObjectURL(saved.url);
    };
  }, [saved]);

  async function saveGlyph() {
    if (!glyph.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await setEmblem({ topicSlug, emblem: { kind: "glyph", glyph } });
      setSaved({ kind: "glyph", glyph: glyph.trim() });
    } catch (e) {
      setError(errorText(e, "Couldn’t set that glyph."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await normaliseEmblemImage(file);
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/webp" }, body: blob });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setEmblem({ topicSlug, emblem: { kind: "image", storageId, contentType: "image/webp" } });
      setSaved({ kind: "image", url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(errorText(e, "Couldn’t upload that image."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[92vw] max-w-md rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 className="text-sm font-semibold text-accent">Certificate emblem</h2>
        <button
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-5 px-6 py-6">
        <p className="text-xs text-soft">
          The mark of your subject, shown on the certificate. Set an emoji or short character, or upload an image (it’s
          resized to a small square automatically). Your choice overrides the automatic one.
        </p>

        {saved && (
          <div className="flex items-center gap-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/60 bg-card">
              {saved.kind === "image" ? (
                <img src={saved.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl leading-none">{saved.glyph}</span>
              )}
            </div>
            <p className="text-xs font-medium text-accent">
              Emblem updated ✓ It appears on certificates earned from here on — ones already claimed keep their original
              mark.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Glyph</label>
          <div className="flex gap-1">
            <input
              value={glyph}
              onChange={(e) => setGlyph(e.target.value)}
              placeholder="🪷"
              className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-center text-lg focus:border-gold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void saveGlyph()}
              disabled={busy || !glyph.trim()}
              className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Or upload an image</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // let the same file be re-picked after an error
              if (f) void uploadImage(f);
            }}
            className="text-sm text-soft file:mr-3 file:rounded-lg file:border-0 file:bg-accent2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
          />
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
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
    <main className="cert-print-page mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="cert-enter w-full">
        <CertificateCard {...cert} showcase />
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
