"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type CSSProperties } from "react";
import { CertificateCard, type CertificateData } from "./Certificate";
import { Icon, type IconName } from "./icons";
import { Brand } from "./Brand";
import { SignIn } from "./SignIn";
import { SiteFooter } from "./SiteFooter";
import { useTheme } from "./ThemeContext";

// The public front door (landing-page/01): what a logged-out visitor sees at `/`.
// Markets the real product in glossary terms — user-facing "course" is a Topic —
// and reuses the certificate stage's aurora + gold-fleck atmosphere (globals.css
// `.cert-stage`) so it reads as the same product. All motion is CSS (`.land-*`),
// suppressed under prefers-reduced-motion; no motion.dev dependency.

// Display copy lives in the "Landing" namespace; the constants hold only the
// stable per-item keys (step index, feature icon) and copy is resolved with
// t(...) inside the component at render.
const STEP_KEYS = ["seed", "author", "advance"] as const;

const FEATURE_KEYS: { icon: IconName; key: string }[] = [
  { icon: "book", key: "grounded" },
  { icon: "edit", key: "interactive" },
  { icon: "chat", key: "ask" },
  { icon: "refresh", key: "references" },
  { icon: "globe", key: "language" },
  { icon: "link", key: "share" },
];

// A finished-course certificate with demo data, so the landing shows the real
// artefact (tilt, foil and all) instead of a mock-up. Fixed timestamp — the demo
// is a specimen, not a live document.
const DEMO_CERT: CertificateData = {
  learnerName: "Asha Patel",
  courseTitle: "The Night Sky, from Your Field Guide",
  lessonCount: 24,
  issuedAt: Date.UTC(2026, 5, 21),
  lang: "en",
  emblem: { kind: "glyph", glyph: "🔭" },
};

// The demo certificate renders dates via toLocaleDateString, which can disagree
// between the server and a non-US visitor's browser — mount-gate it so it only
// ever renders client-side and can't cause a hydration mismatch.
function DemoCertificate() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="min-h-104" aria-hidden />;
  return <CertificateCard {...DEMO_CERT} />;
}

// Icon-only light/dark toggle for the landing nav (ADR 0011) — the same compact
// per-surface copy the Dashboard, CourseShell and PublicReader headers carry.
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const tc = useTranslations("Common");
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? tc("themeToLight") : tc("themeToDark")}
      title={dark ? tc("lightMode") : tc("darkMode")}
      className="rounded-lg p-1.5 text-soft transition-colors hover:bg-hi hover:text-accent"
    >
      <Icon name={dark ? "sun" : "moon"} className="h-4 w-4" />
    </button>
  );
}

export function Landing() {
  const t = useTranslations("Landing");
  const steps = STEP_KEYS.map((key) => ({
    key,
    title: t(`steps.${key}.title`),
    body: t(`steps.${key}.body`),
  }));
  const features = FEATURE_KEYS.map(({ icon, key }) => ({
    icon,
    key,
    title: t(`features.${key}.title`),
    body: t(`features.${key}.body`),
  }));
  return (
    <div className="min-h-screen">
      {/* ── Hero — the certificate stage's aurora + gold flecks as atmosphere ── */}
      <header className="cert-stage">
        <nav className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <Brand />
          <span className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="#get-started"
              className="rounded-lg border border-line bg-card/60 px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-gold hover:text-accent"
            >
              {t("nav.signIn")}
            </a>
          </span>
        </nav>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-24 pt-16 text-center sm:pb-32 sm:pt-24">
          <p className="land-rise text-xs font-semibold uppercase tracking-[0.35em] text-accent2">
            {t("hero.eyebrow")}
          </p>
          <h1
            className="land-rise mt-4 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-6xl"
            style={{ "--d": "80ms" } as CSSProperties}
          >
            {t.rich("hero.headline", { em: (chunks) => <em className="text-accent">{chunks}</em> })}
          </h1>
          <p
            className="land-rise mt-6 max-w-xl text-base text-soft sm:text-lg"
            style={{ "--d": "160ms" } as CSSProperties}
          >
            {t("hero.subhead")}
          </p>
          <div
            className="land-rise mt-10 flex flex-wrap items-center justify-center gap-3"
            style={{ "--d": "240ms" } as CSSProperties}
          >
            <a
              href="#get-started"
              className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              {t("hero.getStarted")}
            </a>
            <a
              href="#how"
              className="rounded-xl border border-line bg-card px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-accent"
            >
              {t("hero.seeHow")}
            </a>
          </div>
        </div>
      </header>

      {/* ── How it works ── */}
      <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("how.heading")}
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.key} className="land-reveal flex flex-col items-center text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-base font-semibold text-accent">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-accent">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-y border-line bg-card/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {t("features.heading")}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.key}
                className="land-reveal rounded-2xl border border-line bg-card p-6 shadow-sm transition-colors hover:border-gold/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-accent">
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-soft">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Certificate showcase — the real card, demo data ── */}
      <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div className="land-reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent2">{t("certificates.eyebrow")}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {t("certificates.heading")}
          </h2>
          <p className="mt-4 leading-relaxed text-soft">
            {t("certificates.body")}
          </p>
          <p className="mt-3 text-sm italic text-soft">{t("certificates.hint")}</p>
        </div>
        <div className="land-reveal mx-auto w-full max-w-md">
          <DemoCertificate />
        </div>
      </section>

      {/* ── Get started — the existing sign-in flow, embedded on the stage ── */}
      <section id="get-started" className="cert-stage border-t border-line">
        <div className="relative z-10">
          <SignIn />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
