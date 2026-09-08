"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../../../convex/_generated/api";
import { posterModel, type PosterEdits } from "~/lib/poster";
import { publicCourseUrl } from "./editionUrl";

// The anonymous `/poster/[token]` page (course-poster spec): the Edition's
// poster, painted from what the model returns, with the owner's render-local
// panel beside it. Three reads: the Guest course by token (the same bundle the
// share reader gets, so a leaked poster URL leaks nothing more), the COURSE's
// tenant theme (by the course's tenant slug, not the request host, so a poster
// opened on the apex still wears the right brand), and the owner check (the
// Editions query answers null for anyone but the signed-in owner).
//
// Owner edits live in this component's state and are written nowhere. The PNG is
// a client-side rasterisation of the sheet's DOM at 2x, so the browser's own
// text layout, fonts and bidi are what get painted; the renderer is imported on
// the click, like the QR encoder. Print uses poster.css's print rules.
export function PosterPage({ token, fontClass }: { token: string; fontClass: string }) {
  const t = useTranslations("Poster");
  const course = useQuery(api.public.publicCourse, { token });
  const tenant = useQuery(api.tenantTheme.getTheme, course?.tenantSlug ? { slug: course.tenantSlug } : "skip");
  const owned = useQuery(api.translate.editions, course ? { topicSlug: course.slug } : "skip");

  const [highlights, setHighlights] = useState(["", ""]);
  const [tagline, setTagline] = useState("");
  const [emphasis, setEmphasis] = useState<PosterEdits["emphasis"]>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // The QR encodes the canonical public URL, the same one the Sharing tab's QR
  // download encodes, at 600 px with margin 2.
  const shareUrl = course ? publicCourseUrl(token, course.tenantSlug) : null;
  useEffect(() => {
    if (!shareUrl) return;
    let live = true;
    import("qrcode")
      .then((m) => m.default.toDataURL(shareUrl, { width: 600, margin: 2 }))
      .then((url) => live && setQr(url))
      .catch(() => {
        /* the sheet renders without its QR; the download will show the gap */
      });
    return () => {
      live = false;
    };
  }, [shareUrl]);

  // Fit the 1080 px canvas to the viewport on screen; print and PNG ignore this.
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 32) / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  if (course === undefined || (course?.tenantSlug && tenant === undefined) || !shareUrl) {
    if (course === null) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
          <h1 className="text-lg font-semibold text-accent">{t("notFound")}</h1>
          <p className="max-w-sm text-sm text-soft">{t("notFoundBody")}</p>
        </main>
      );
    }
    return <main className="flex min-h-dvh items-center justify-center p-8 text-sm text-soft">{t("loading")}</main>;
  }
  if (course === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold text-accent">{t("notFound")}</h1>
        <p className="max-w-sm text-sm text-soft">{t("notFoundBody")}</p>
      </main>
    );
  }

  const m = posterModel(
    {
      course,
      tenant: course.tenantSlug ? (tenant ?? null) : null,
      edits: { highlights, emphasis, tagline },
      shareUrl,
    },
    (key, values) => t(key, values),
  );
  const isOwner = owned != null;

  // The owner selects a run of words in the poster's own title and presses the
  // button; the selection's offsets into the title text become the emphasis.
  const emphasise = () => {
    const h1 = titleRef.current;
    const sel = window.getSelection();
    if (!h1 || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!h1.contains(range.startContainer) || !h1.contains(range.endContainer)) return;
    const lead = document.createRange();
    lead.selectNodeContents(h1);
    lead.setEnd(range.startContainer, range.startOffset);
    const start = lead.toString().length;
    setEmphasis({ start, end: start + range.toString().length });
    sel.removeAllRanges();
  };

  const download = async () => {
    const node = sheetRef.current;
    if (!node) return;
    setBusy(true);
    setError(null);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(node, { pixelRatio: 2, width: 1080, height: 1350 });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${course.slug}-${course.lang}-poster.png`;
      a.click();
    } catch {
      setError(t("pngError"));
    } finally {
      setBusy(false);
    }
  };

  const sheetStyle = {
    "--cream": m.palette.cream,
    "--cream2": m.palette.cream2,
    "--navy": m.palette.navy,
    "--navy2": m.palette.navy2,
    "--gold": m.palette.gold,
    "--slate": m.palette.slate,
    "--card": m.palette.card,
  } as CSSProperties;

  const button = "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-60";
  const field = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-soft/60 focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <main className="poster-stage bg-paper">
      <div className="poster-scale" style={{ "--s": scale } as CSSProperties}>
        <div ref={sheetRef} className={`poster-sheet ${fontClass}`} lang={m.lang} dir={m.dir} data-script={m.script} style={sheetStyle}>
          <div className="poster-frame" />
          <div className="poster-page">
            {m.logoUrl ? (
              <img className="poster-logo" src={m.logoUrl} alt={m.tenantName} />
            ) : (
              <div className="poster-logo-fallback">{m.tenantName}</div>
            )}
            {/* The body centres in whatever the logo and footer leave, so a sheet
                with no tagline and no highlights does not float up and leave a
                void above the footer; a full sheet lays out as the template. */}
            <div className="poster-body">
            <div className="poster-eyebrow">{m.eyebrow}</div>
            <h1 ref={titleRef} data-len={m.titleLen}>
              {m.title.before}
              {m.title.em && <em>{m.title.em}</em>}
              {m.title.after}
            </h1>
            {m.tagline && <p className="poster-sub">{m.tagline}</p>}
            <div className="poster-rule" />
            <ul className="poster-points">
              {m.points.map((p, i) => (
                <li key={`${i}-${p}`}>{p}</li>
              ))}
            </ul>
            <section className="poster-card">
              <div className="poster-qr">{qr && <img src={qr} alt={t("qrAlt")} />}</div>
              <div>
                <div className="poster-cta-kicker">{m.cta.kicker}</div>
                <div className="poster-cta-title">{m.cta.title}</div>
                <p className="poster-cta-or">{m.cta.or}</p>
                <div className="poster-url">{m.host}</div>
                {m.price && (
                  <p className="poster-price">
                    <strong>{m.price.label}</strong> {m.price.suffix}
                  </p>
                )}
              </div>
            </section>
            </div>
            <footer className="poster-footer">
              <div className="poster-langs">
                {m.langs && (
                  <>
                    {t.rich("langsLine1", { count: m.langs.count, strong: (c) => <strong>{c}</strong> })}
                    <br />
                    {m.langs.more > 0
                      ? t("langsMore", { names: m.langs.named.join(" · "), more: m.langs.more })
                      : t("langsNames", { names: m.langs.named.join(" · ") })}
                  </>
                )}
              </div>
              <div className="poster-brand">
                <b>{m.tenantName}</b>
                {m.tenantMotto && <span>{m.tenantMotto}</span>}
              </div>
            </footer>
          </div>
        </div>
      </div>

      <div className="no-print flex w-full max-w-2xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" disabled={busy} onClick={() => void download()} className={`${button} bg-accent text-white hover:bg-accent/90`}>
            {busy ? t("downloading") : t("downloadPng")}
          </button>
          <button type="button" onClick={() => window.print()} className={`${button} border border-gold/50 bg-card text-accent hover:bg-hi`}>
            {t("print")}
          </button>
        </div>
        {error && <p className="text-center text-sm text-danger">{error}</p>}

        {isOwner && (
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">{t("panelTitle")}</h2>
              <p className="text-xs text-soft">{t("panelBody")}</p>
            </div>
            {[0, 1].map((i) => (
              <label key={i} className="flex flex-col gap-1 text-xs font-medium text-soft">
                {t(i === 0 ? "highlight1" : "highlight2")}
                <input
                  className={field}
                  dir={m.dir}
                  value={highlights[i]}
                  placeholder={t("highlightPlaceholder")}
                  onChange={(e) => setHighlights((h) => h.map((v, j) => (j === i ? e.target.value : v)))}
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs font-medium text-soft">
              {t("taglineLabel")}
              <input className={field} dir={m.dir} value={tagline} placeholder={t("taglinePlaceholder")} onChange={(e) => setTagline(e.target.value)} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={emphasise} className={`${button} border border-line bg-hi text-ink hover:bg-line/40`}>
                {t("emphasise")}
              </button>
              {emphasis && (
                <button type="button" onClick={() => setEmphasis(null)} className={`${button} border border-line bg-card text-soft hover:bg-hi`}>
                  {t("clearEmphasis")}
                </button>
              )}
              <span className="text-xs text-soft">{t("emphasiseHint")}</span>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
