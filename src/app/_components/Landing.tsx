"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { CertificateCard, type CertificateData } from "./Certificate";
import { Icon, type IconName } from "./icons";
import { Logo } from "./Logo";
import { SignIn } from "./SignIn";
import { useTheme } from "./ThemeContext";

// The public front door (landing-page/01): what a logged-out visitor sees at `/`.
// Markets the real product in glossary terms — user-facing "course" is a Topic —
// and reuses the certificate stage's aurora + gold-fleck atmosphere (globals.css
// `.cert-stage`) so it reads as the same product. All motion is CSS (`.land-*`),
// suppressed under prefers-reduced-motion; no motion.dev dependency.

const STEPS = [
  {
    title: "Seed a course",
    body: "Give it a title, say why you're learning, and upload the reading you trust — a handbook, a scripture, your own notes.",
  },
  {
    title: "An AI author gets writing",
    body: "It studies your sources and publishes your first lesson — an interactive page written from your reading, never over it.",
  },
  {
    title: "Learn, ask, advance",
    body: "Finish a lesson and the next one is written for you. The course unfolds at your pace, all the way to a certificate.",
  },
];

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "book",
    title: "Grounded in your reading",
    body: "Your uploaded resources are the syllabus. Lessons are written from them and never trust ungrounded knowledge over them.",
  },
  {
    icon: "edit",
    title: "Interactive lessons",
    body: "Every lesson is a self-contained interactive page — reading, worked examples, and quizzes that check you actually got it.",
  },
  {
    icon: "chat",
    title: "Ask anything",
    body: "Stuck mid-lesson? Ask right there. The author reads your question and replies inline, in the lesson where you asked it.",
  },
  {
    icon: "refresh",
    title: "References that stay current",
    body: "Alongside lessons you get living cheat-sheets — glossaries and key facts the author revises as your understanding deepens.",
  },
  {
    icon: "globe",
    title: "In any language",
    body: "Turn a course into a full edition in another language — the same lessons, re-authored, not machine-glossed. Switch any time.",
  },
  {
    icon: "link",
    title: "Share & public links",
    body: "Share a course with someone by email — read-only or with editing rights — or mint an anonymous public link anyone can open.",
  },
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

export function Landing() {
  return (
    <div className="min-h-screen">
      {/* ── Hero — the certificate stage's aurora + gold flecks as atmosphere ── */}
      <header className="cert-stage">
        <nav className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <span className="flex items-center gap-2">
            <Logo className="h-8 w-8 text-accent" />
            <span className="text-lg font-semibold tracking-tight text-accent">My Course</span>
          </span>
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
            An AI course studio
          </p>
          <h1
            className="land-rise mt-4 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-6xl"
            style={{ "--d": "80ms" } as CSSProperties}
          >
            Learn anything, grounded in <em className="text-accent">your</em> reading.
          </h1>
          <p
            className="land-rise mt-6 max-w-xl text-base text-soft sm:text-lg"
            style={{ "--d": "160ms" } as CSSProperties}
          >
            Seed a topic with the sources you trust, and an AI author writes you an interactive course — lesson by
            lesson, as you learn — all the way to a certificate.
          </p>
          <div
            className="land-rise mt-10 flex flex-wrap items-center justify-center gap-3"
            style={{ "--d": "240ms" } as CSSProperties}
          >
            <a
              href="#get-started"
              className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              Get started
            </a>
            <a
              href="#how"
              className="rounded-xl border border-line bg-card px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-accent"
            >
              See how it works
            </a>
          </div>
        </div>
      </header>

      {/* ── How it works ── */}
      <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          A course that's written as you learn it
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="land-reveal flex flex-col items-center text-center">
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
            Built for real study, not a feed of videos
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
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
        </div>
      </section>

      {/* ── Certificate showcase — the real card, demo data ── */}
      <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div className="land-reveal">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent2">Certificates</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Finish the course. Keep the proof.
          </h2>
          <p className="mt-4 leading-relaxed text-soft">
            Every completed course ends in a certificate — a printable, shareable document with your name on it, at a
            link you can hand to anyone. No account needed to admire it.
          </p>
          <p className="mt-3 text-sm italic text-soft">Go on — run your pointer over it.</p>
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

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-6 py-10 text-center text-sm text-soft">
          <span className="flex items-center gap-2 text-accent">
            <Logo className="h-6 w-6" />
            <span className="font-semibold">My Course</span>
          </span>
          <p>
            Born teaching Hindi — <span className="font-deva">नमस्ते</span> — built to teach anything.
          </p>
          {/* PayFast compliance: terms, privacy, and the refund policy linked site-wide,
              plus the payment method and a contact address visible on the home page. */}
          <nav className="mt-1 flex flex-wrap justify-center gap-4">
            <Link href="/terms" className="hover:text-accent">Terms &amp; Conditions</Link>
            <Link href="/privacy" className="hover:text-accent">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-accent">Refunds &amp; Cancellation</Link>
          </nav>
          <p className="text-xs">
            Payments securely processed by Payfast (card &amp; Instant EFT) ·{" "}
            <a href="mailto:support@my-course.app" className="hover:text-accent">support@my-course.app</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
