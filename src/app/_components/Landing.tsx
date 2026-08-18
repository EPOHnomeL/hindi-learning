"use client";

import { useTranslations } from "next-intl";
import { type CSSProperties } from "react";
import { DonateSection } from "./DonateSection";
import { Icon, type IconName } from "./icons";
import { Brand } from "./Brand";
import { InterestForm, type InterestFormCopy } from "./InterestForm";
import { CapabilityBand, Faq, FounderQuote, type CapabilityTile, type FaqItem } from "./LandingSections";
import { PhoneMockRow, type PhoneMockCopy } from "./PhoneMocks";
import { SignIn } from "./SignIn";
import { SiteFooter } from "./SiteFooter";
import { useTheme } from "./ThemeContext";

// The public front door (landing-page/01): what a logged-out visitor sees at `/`.
// Markets the real product in glossary terms — user-facing "course" is a Topic —
// and reuses the certificate stage's aurora + gold-fleck atmosphere (globals.css
// `.cert-stage`) so it reads as the same product. All motion is CSS (`.land-*`),
// suppressed under prefers-reduced-motion; no motion.dev dependency.
//
// **Restructured 2026-08-07** against spoorpet.com as a brief, which converts
// strangers well. What was taken from it:
//   - device mockups **built in CSS**, so they can't go stale like a screenshot;
//   - a band of **capability tiles** (its `24/7 · GPS · Weeks · SA`) — note those
//     are capabilities, not traction numbers, which is why the section works on a
//     page with no crowd yet;
//   - a **founder quote** as the trust anchor;
//   - an **objection-first FAQ**, hardest question at the top;
//   - **one** email-capture form, and its success state replaces it.
// What was deliberately NOT taken: its form sits above the fold because it has
// nothing to sell. Ours is below sign-in, because sign-in is the conversion here
// and the address is the fallback (see InterestForm).
//
// **The certificate is no longer a section.** It used to have half a page and a
// live demo card; it is a PNG with no compliance weight behind it, so leading on
// it oversold the product. It still exists, it just isn't the pitch.

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

  const phoneCopy: PhoneMockCopy = {
    courseTitle: t("mocks.phone.courseTitle"),
    lessonProgress: t("mocks.phone.lessonProgress"),
    askCta: t("mocks.phone.askCta"),
    quizQuestion: t("mocks.phone.quizQuestion"),
    quizOptions: [t("mocks.phone.quizOptionA"), t("mocks.phone.quizOptionB"), t("mocks.phone.quizOptionC")],
    askedQuestion: t("mocks.phone.askedQuestion"),
    askedReply: t("mocks.phone.askedReply"),
    askedFollowUp: t("mocks.phone.askedFollowUp"),
  };

  const tiles: CapabilityTile[] = [1, 2, 3, 4].map((n) => ({
    v: t(`capabilities.t${n}v`),
    l: t(`capabilities.t${n}l`),
  }));

  const faqItems: FaqItem[] = [1, 2, 3, 4, 5].map((n) => ({ q: t(`faq.q${n}`), a: t(`faq.a${n}`) }));

  const interestCopy: InterestFormCopy = {
    heading: t("interest.heading"),
    body: t("interest.body"),
    placeholder: t("interest.placeholder"),
    submit: t("interest.submit"),
    submitting: t("interest.submitting"),
    invalid: t("interest.invalid"),
    failed: t("interest.failed"),
    doneTitle: t("interest.doneTitle"),
    doneBody: t("interest.doneBody"),
    fieldLabel: t("interest.fieldLabel"),
  };

  // The founder quote is the operator's own words or it is nothing. `founder.quote`
  // ships EMPTY (messages/*.json) precisely so this section can't render invented
  // origin-story prose: writing the quote turns the section on, and no code change
  // is needed to do it.
  const founderQuote = t("founder.quote");

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
              className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              {t("hero.getStarted")}
            </a>
            <a
              href="#how"
              className="rounded-lg border border-line bg-card px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-accent"
            >
              {t("hero.seeHow")}
            </a>
          </div>
        </div>
      </header>

      {/* ── How it works ── */}
      <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("how.heading")}</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.key}
              className={`${["land-reveal", "land-reveal-mid", "land-reveal-late"][i]} flex flex-col items-center text-center`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-base font-semibold text-accent">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-accent">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The product itself, in CSS phone frames — the section that replaced
             the certificate showcase. A lesson, a quiz inside it, and a question
             answered where it was asked. ── */}
      <section className="border-y border-line bg-card/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <div className="land-reveal mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("mocks.heading")}</h2>
            <p className="mt-3 leading-relaxed text-soft">{t("mocks.body")}</p>
          </div>
          <PhoneMockRow
            copy={phoneCopy}
            captions={[
              { title: t("mocks.lesson.title"), body: t("mocks.lesson.body") },
              { title: t("mocks.quiz.title"), body: t("mocks.quiz.body") },
              { title: t("mocks.ask.title"), body: t("mocks.ask.body") },
            ]}
          />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("features.heading")}
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.key}
              className="land-reveal rounded-lg border border-line bg-card p-6 shadow-sm transition-colors hover:border-gold/60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold/15 text-accent">
                <Icon name={f.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Capability tiles ── */}
      <CapabilityBand heading={t("capabilities.heading")} body={t("capabilities.body")} tiles={tiles} />

      {/* ── Founder quote — renders only once the operator has written one ── */}
      {founderQuote !== "" && <FounderQuote quote={founderQuote} byline={t("founder.byline")} />}

      {/* ── FAQ, hardest objection first ── */}
      <section className="mx-auto w-full max-w-3xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("faq.heading")}</h2>
        <Faq items={faqItems} />
      </section>

      {/* ── Donations (ADR 0027) — renders itself only on a tenant whose
             `donations` flag is on, so the default site and every unflagged
             tenant see nothing here. Placed automatically on this shared page:
             a bespoke landing (YwamPotch) has to place it by hand, but a tenant
             that hasn't paid for one shouldn't need a code change to be able to
             switch the flag on. ── */}
      <DonateSection />

      {/* ── Get started — the existing sign-in flow, embedded on the stage ── */}
      <section id="get-started" className="cert-stage border-t border-line">
        <div className="relative z-10">
          <SignIn />
        </div>
      </section>

      {/* ── The softer ask, for whoever scrolled past sign-in (ADR 0028) ── */}
      <section className="border-t border-line bg-card/60">
        <div className="mx-auto w-full max-w-xl px-6 py-16">
          <InterestForm source="landing-footer" copy={interestCopy} />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
