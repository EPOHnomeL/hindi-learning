"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Brand } from "../_components/Brand";
import { DonateSection } from "../_components/DonateSection";
import { Icon, type IconName } from "../_components/icons";
import { SignIn } from "../_components/SignIn";
import { SiteFooter } from "../_components/SiteFooter";
import { useTheme } from "../_components/ThemeContext";

// Bespoke landing page for the `ywampotch` tenant (whitelabel/16 registry).
// Content is drawn from ywampotch.com (mission, founders, focus areas) rather
// than the generic marketing copy — hand-authored per-tenant, hardcoded English
// (no next-intl namespace): this is one ministry's own copy, not a translatable
// platform surface, so a new i18n namespace would be pure overhead.
const PUBLIC_LINK = "https://ywampotch.my-course.app/share/997211aaa328aa8e9a94fd20dc4c7369703b1f32aaa21ae88a89e64f8dd29348";

const FOCUS_AREAS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "book",
    title: "Prophetic School",
    body: "Growing in the Holy Spirit — hearing God's voice, walking in your creation design, and stepping into prophetic ministry.",
  },
  {
    icon: "chat",
    title: "Transformation Prayer Ministry",
    body: "One-on-one prayer sessions and TPM training that bring Biblical truth to the places pain and lies have taken root.",
  },
  {
    icon: "globe",
    title: "Operation Refugee Africa",
    body: "Practical mercy ministry among displaced and marginalised communities — showing God's love in tangible ways.",
  },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="rounded-lg p-1.5 text-soft transition-colors hover:bg-hi hover:text-accent"
    >
      <Icon name={dark ? "sun" : "moon"} className="h-4 w-4" />
    </button>
  );
}

export function YwamPotch() {
  return (
    <div className="min-h-screen">
      {/* ── Hero ── */}
      <header className="cert-stage">
        <nav className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <Brand />
          <span className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="#get-started"
              className="rounded-lg border border-line bg-card/60 px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-gold hover:text-accent"
            >
              Sign in
            </a>
          </span>
        </nav>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-24 pt-16 text-center sm:pb-32 sm:pt-24">
          <p className="land-rise text-xs font-semibold uppercase tracking-[0.35em] text-accent2">
            Youth With A Mission — Potchefstroom
          </p>
          <h1
            className="land-rise mt-4 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-6xl"
            style={{ "--d": "80ms" } as CSSProperties}
          >
            Discover your <em className="text-accent">calling</em>, walk in your creation design.
          </h1>
          <p
            className="land-rise mt-6 max-w-xl text-base text-soft sm:text-lg"
            style={{ "--d": "160ms" } as CSSProperties}
          >
            YWAM Potch exists to help you grow in Lordship and in your relationship with God, through
            evangelism, training, and mercy ministries — Prophetic School, Transformation Prayer Ministry,
            and Operation Refugee Africa.
          </p>
          <div
            className="land-rise mt-10 flex flex-wrap items-center justify-center gap-3"
            style={{ "--d": "240ms" } as CSSProperties}
          >
            <a
              href={PUBLIC_LINK}
              className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              Get Prophetic School
            </a>
            <a
              href="#focus"
              className="rounded-xl border border-line bg-card px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-accent"
            >
              Our focus areas
            </a>
          </div>
        </div>
      </header>

      {/* ── Focus areas ── */}
      <section id="focus" className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Evangelism. Training. Mercy.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-soft">
          Founded in 2013 by Wikus and Christien Vorster, our base currently focuses on three ministries.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {FOCUS_AREAS.map((f) => (
            <div
              key={f.title}
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
      </section>

      {/* ── Prophetic School — the buy CTA ── */}
      <section className="border-y border-line bg-card/60">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
          <div className="land-reveal">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent2">Prophetic School</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Growing in the Holy Spirit
            </h2>
            <p className="mt-4 leading-relaxed text-soft">
              A self-paced course to help you hear God's voice with confidence and grow in prophetic
              ministry — study anywhere, at your own pace, with a certificate at the end.
            </p>
            <a
              href={PUBLIC_LINK}
              className="mt-6 inline-flex rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              Get the course
            </a>
          </div>
          <div className="land-reveal flex justify-center">
            <span className="flex h-40 w-40 items-center justify-center rounded-full bg-gold/15 text-accent">
              <Icon name="award" className="h-16 w-16" />
            </span>
          </div>
        </div>
      </section>

      {/* ── Donations (ADR 0027) — placed BY HAND, because this page is bespoke:
             the tenant flag controls whether the section renders, not where. It
             sits after the course CTA and before sign-in, so a visitor who came
             to buy isn't asked for a gift first. Its copy is the platform's
             (next-intl), unlike the hand-authored English around it — the
             section is shared, and the money disclosures in it are ours. ── */}
      <DonateSection />

      {/* ── Sign in ── */}
      <section id="get-started" className="cert-stage border-t border-line">
        <div className="relative z-10">
          <SignIn />
        </div>
      </section>

      <p className="mx-auto -mt-4 max-w-5xl px-6 pb-4 text-center text-xs text-soft">
        Questions? Reach us at{" "}
        <a href="mailto:ywampotch@gmail.com" className="hover:text-accent">
          ywampotch@gmail.com
        </a>
      </p>

      <SiteFooter />
    </div>
  );
}
