"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useEditionLang } from "./editionUrl";
import { langDir } from "../../../convex/languages";
import type { Id } from "../../../convex/_generated/dataModel";
import { Icon } from "./icons";
import { Menu, MenuItem } from "./ui";

// The resolved Emblem (ADR 0017) as the read seams return it — an image resolves
// to a same-origin URL, otherwise a glyph (a subject emoji or the generic default).
export type CertificateEmblem = { kind: "image"; url: string } | { kind: "glyph"; glyph: string };

export type CertificateData = {
  learnerName: string;
  courseTitle: string;
  lessonCount: number;
  issuedAt: number;
  // The Edition's language (course-translation): the card derives its text
  // direction from this, so an RTL-titled certificate reads correctly on every
  // surface (in-app dialog, celebration, and the public page) from one source.
  lang: string;
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

// The visual Certificate. Presentational only; no data fetching, so its surfaces
// can't drift. Two treatments off the same props:
//   - compact (`CertificateCompact`) — the in-app claim dialog: a small framed
//     card with the metallic medallion + foil + pointer tilt (ADR 0017).
//   - showcase (`CertificateShowcase`) — the standalone /certificate/[token]
//     page: a full A4-landscape document with a double gold frame, filigree
//     corners, a guilloché weave, a foil wax seal, and signature rules. Sized in
//     container units so it scales as one block from phone to desktop and prints
//     to a true A4 page (globals.css `.cert-doc*`, `@media print`).
// Both degrade to a flat engraved document under print + reduced-motion. Brand:
// "My Course".
export function CertificateCard(props: CertificateData) {
  return props.showcase ? <CertificateShowcase {...props} /> : <CertificateCompact {...props} />;
}

function CertificateCompact({ learnerName, courseTitle, lessonCount, issuedAt, lang, emblem }: CertificateData) {
  const date = new Date(issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return (
    <div
      dir={langDir(lang)}
      className="cert-card relative isolate overflow-hidden rounded-2xl border-2 border-gold/60 bg-card px-8 py-10 text-center shadow-sm"
      onMouseMove={onCardMove}
      onMouseLeave={onCardLeave}
    >
      <div className="cert-sheen pointer-events-none absolute inset-0" aria-hidden />
      <div className="cert-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-2 rounded-xl border border-gold/30" aria-hidden />
      <div className="relative z-10">
        <div className="cert-medallion mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-gold/70">
          <EmblemMark emblem={emblem} />
        </div>
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
    </div>
  );
}

// One filigree corner ornament, flipped into each of the four corners by its
// modifier class (globals.css `.cert-corner--*`). Decorative, so aria-hidden.
function CertCorner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  return (
    <svg
      className={`cert-corner cert-corner--${pos} pointer-events-none absolute`}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
    >
      <path d="M6 48C6 24 24 6 48 6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 32C6 17 17 6 32 6" stroke="currentColor" strokeWidth="1" />
      <path d="M12 66C12 42 26 30 44 30" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
      <circle cx="48" cy="48" r="2.4" fill="currentColor" />
    </svg>
  );
}

function CertificateShowcase({ learnerName, courseTitle, lessonCount, issuedAt, lang, emblem }: CertificateData) {
  const date = new Date(issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return (
    // The shell owns the container-query context (`container-type: inline-size`),
    // so every `cqw` inside — including the card's own padding — resolves against
    // the card's width and the whole document scales as one unit.
    <div className="cert-doc-shell mx-auto w-full">
    <div
      dir={langDir(lang)}
      className="cert-card cert-card--showcase cert-doc relative isolate w-full overflow-hidden bg-card"
      onMouseMove={onCardMove}
      onMouseLeave={onCardLeave}
    >
      <div className="cert-doc-weave pointer-events-none absolute inset-0" aria-hidden />
      <div className="cert-sheen pointer-events-none absolute inset-0" aria-hidden />
      <div className="cert-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="cert-shine pointer-events-none absolute inset-0" aria-hidden />
      <div className="cert-doc-frame pointer-events-none absolute" aria-hidden />
      <CertCorner pos="tl" />
      <CertCorner pos="tr" />
      <CertCorner pos="bl" />
      <CertCorner pos="br" />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="cert-medallion flex items-center justify-center overflow-hidden rounded-full">
          <EmblemMark emblem={emblem} large />
        </div>
        <p className="cert-doc-eyebrow">Certificate of Completion</p>
        <p className="cert-doc-pre cert-doc-pre--lead">This certifies that</p>
        <p className="cert-doc-name">{learnerName}</p>
        <div className="cert-doc-rule" aria-hidden>
          <span className="cert-doc-rule-line" />
          <span className="cert-doc-diamond">✦</span>
          <span className="cert-doc-rule-line" />
        </div>
        <p className="cert-doc-pre">has completed the course</p>
        <p className="cert-doc-title">{courseTitle}</p>
        <p className="cert-doc-meta">
          Completed {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
        </p>

        <div className="cert-doc-footer">
          <div className="cert-doc-sig">
            <span className="cert-doc-sig-mark">My Course</span>
            <span className="cert-doc-sig-line" />
            <span className="cert-doc-sig-label">Issued by</span>
          </div>
          <div className="cert-doc-seal" aria-hidden>
            <span className="cert-doc-seal-star">★</span>
          </div>
          <div className="cert-doc-sig">
            <span className="cert-doc-sig-mark cert-doc-sig-mark--date">{date}</span>
            <span className="cert-doc-sig-line" />
            <span className="cert-doc-sig-label">Date issued</span>
          </div>
        </div>
      </div>
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
  // the shareable, printable surface — rather than an in-app dialog. A real anchor
  // (not window.open) so the new tab is never popup-blocked: window.open with a
  // features string opens a *popup*, which browsers silently blocked on the
  // deployed domain (it "worked" only on localhost). `inline-flex … justify-center`
  // makes the anchor lay out like the button it replaces — a centred label, and
  // full-width when the caller passes `w-full`. Eligible but not yet earned: open
  // the claim dialog.
  if (certificate) {
    return (
      <a
        href={`/certificate/${certificate.token}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 ${btnClass}`}
      >
        <Icon name="award" className="h-4 w-4" /> View your certificate
      </a>
    );
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className={`inline-flex items-center justify-center gap-2 ${btnClass}`}>
        <Icon name="award" className="h-4 w-4" /> Claim your certificate
      </button>
      {open && <CertificateDialog topicSlug={topicSlug} certificate={null} onClose={() => setOpen(false)} />}
    </>
  );
}

// A completed course card's ⋯ overflow (UI redesign): the certificate lives here
// rather than as a full-width bar on the card face. Renders "View certificate"
// (opens the standalone public page in a new tab) once earned, or "Claim
// certificate" (opens the claim dialog) while eligible — with a gold dot on the ⋯
// trigger to flag the unclaimed one. Self-hides (no ⋯ at all) when there's no
// certificate to offer, so the card never shows an empty menu. Owner and Viewer
// alike — myCertificate is owner-or-Viewer gated server-side.
export function CourseCertMenu({ topicSlug }: { topicSlug: string }) {
  const data = useQuery(api.certificates.myCertificate, { topicSlug });
  const [claiming, setClaiming] = useState(false);
  if (!data) return null;
  const { certificate, eligible } = data;
  if (!certificate && !eligible) return null;
  const unclaimed = !certificate && eligible;

  return (
    <>
      <Menu triggerLabel="Certificate" dot={unclaimed}>
        {(close) =>
          certificate ? (
            <MenuItem
              icon="award"
              iconTone="gold"
              trailingIcon="ext"
              href={`/certificate/${certificate.token}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              View certificate
            </MenuItem>
          ) : (
            <MenuItem
              icon="award"
              iconTone="gold"
              onClick={() => {
                close();
                setClaiming(true);
              }}
            >
              Claim certificate
            </MenuItem>
          )
        }
      </Menu>
      {claiming && <CertificateDialog topicSlug={topicSlug} certificate={null} onClose={() => setClaiming(false)} />}
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

// The completion moment (ADR 0015): the first time a learner is eligible or
// just-earned on a completed course — owner or Viewer, whenever they next load it,
// not only at the instant of "Mark complete" — auto-mint the Certificate (blank
// name → the account email's local-part) and open its standalone page in a new
// tab, alongside a one-shot confetti burst. This replaces the old in-app claim
// dialog: no name prompt, no modal. Fires once per device via a per-device
// localStorage marker, so revisiting a completed lesson doesn't re-trigger it.
// `window.open` from this (non-click) effect is popup-blocked by most browsers, so
// when the tab doesn't open we fall back to a small, dismissible banner — a
// one-click, never-blocked anchor. The persistent CertificateControl remains the
// way to view it again later.
export function CompletionCelebration({ topicSlug }: { topicSlug: string }) {
  const data = useQuery(api.certificates.myCertificate, { topicSlug });
  const claim = useMutation(api.certificates.claimCertificate);
  // The Edition being read (course-translation) — snapshot its title onto the
  // certificate, so finishing the Spanish edition earns a Spanish-titled one.
  const lang = useEditionLang();
  const firedRef = useRef(false);
  // The earned token, surfaced only when the auto-opened tab was popup-blocked —
  // then this renders a one-click fallback link instead of nothing.
  const [blockedToken, setBlockedToken] = useState<string | null>(null);

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
    firedRef.current = true; // guard against a double-fire within this mount

    void (async () => {
      // Reuse an already-earned certificate; otherwise mint one now (blank name →
      // the account email's local-part). Only mark the device as celebrated once we
      // hold a token, so a transient claim failure retries on the next load rather
      // than silently swallowing the moment.
      let token = data.certificate?.token ?? null;
      if (!token) {
        try {
          const cert = await claim({ topicSlug, name: "", lang: lang ?? undefined });
          token = cert.token;
        } catch {
          return; // no longer eligible / raced — the persistent control still offers it
        }
      }
      try {
        localStorage.setItem(`${CELEBRATED_KEY}:${topicSlug}`, "1");
      } catch {
        /* ignore */
      }
      fireConfetti();
      const opened = window.open(`/certificate/${token}`, "_blank", "noopener,noreferrer");
      if (!opened) setBlockedToken(token); // popup-blocked — offer a one-click link
    })();
  }, [data, topicSlug, claim, lang]);

  if (!blockedToken) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[92vw] max-w-sm items-center justify-between gap-3 rounded-2xl border border-gold/50 bg-card px-4 py-3 text-sm shadow-xl">
      <span className="flex items-center gap-2 text-accent">
        <span aria-hidden>🎉</span> Your certificate is ready.
      </span>
      <a
        href={`/certificate/${blockedToken}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setBlockedToken(null)}
        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
      >
        View →
      </a>
    </div>
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
// default, so this is how an owner picks their own mark.
//
// A section (heading + controls, no dialog chrome), folded into the course
// settings dialog (UI redesign) rather than standing alone. Gated by `canWrite`
// at the call site.
export function EmblemSection({ topicSlug }: { topicSlug: string }) {
  const setEmblem = useMutation(api.emblem.setTopicEmblem);
  const generateUploadUrl = useMutation(api.resources.generateUploadUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const [glyph, setGlyph] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The just-saved Emblem, shown as a confirming preview in the medallion so the
  // owner sees the change land — it otherwise only surfaces on a future
  // certificate. An image preview is a local object URL of the resized blob,
  // revoked when it's replaced or the section unmounts.
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
    <div>
      <h4 className="text-[13px] font-bold text-ink">Certificate emblem</h4>
      <p className="mt-1 text-[12.5px] text-soft">
        The mark of your subject on the certificate. Set an emoji or short character, or upload an image (resized to a
        small square). Your choice overrides the automatic one.
      </p>
      <div className="mt-4 flex items-start gap-4">
        <div className="cert-medallion flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold/70">
          {saved?.kind === "image" ? (
            <img src={saved.url} alt="" className="h-full w-full object-cover" />
          ) : saved?.kind === "glyph" ? (
            <span className="text-2xl leading-none">{saved.glyph}</span>
          ) : (
            <Icon name="award" className="h-6 w-6 text-white/85" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-accent2">Glyph</label>
          <div className="flex gap-1.5">
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
          <label className="mb-1.5 mt-3 block text-[11px] font-bold uppercase tracking-wide text-accent2">
            Or upload an image
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // let the same file be re-picked after an error
              if (f) void uploadImage(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-soft transition-colors hover:border-transparent hover:bg-hi hover:text-accent disabled:opacity-60"
          >
            <Icon name="upload" className="h-4 w-4" /> Choose image…
          </button>
          {saved && (
            <p className="mt-3 text-xs font-medium text-accent">
              Emblem updated — it appears on certificates earned from here on; ones already claimed keep their original
              mark.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </div>
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
    <main className="cert-stage cert-print-page flex min-h-dvh w-full flex-col items-center justify-center gap-7 px-4 py-10">
      {/* Apply the Edition's direction so an RTL-titled certificate renders
          correctly (course-translation). */}
      <div className="cert-enter relative z-10 flex w-full max-w-6xl justify-center" dir={cert.dir}>
        <CertificateCard {...cert} showcase />
      </div>
      <button
        onClick={() => window.print()}
        className="no-print relative z-10 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
      >
        Download PDF
      </button>
    </main>
  );
}
