"use client";

import { type CSSProperties } from "react";
import { Brand } from "../_components/Brand";
import { DonateSection } from "../_components/DonateSection";
import { Icon, type IconName } from "../_components/icons";
import { InterestForm, type InterestFormCopy } from "../_components/InterestForm";
import {
  CapabilityBand,
  Faq,
  FounderQuote,
  type CapabilityTile,
  type FaqItem,
} from "../_components/LandingSections";
import { PhoneMockRow, type PhoneMockCopy } from "../_components/PhoneMocks";
import { SignIn } from "../_components/SignIn";
import { SiteFooter } from "../_components/SiteFooter";
import { useTheme } from "../_components/ThemeContext";

// Bespoke landing page for the `ywampotch` tenant (whitelabel/16 registry).
// Content is drawn from ywampotch.com (mission, founders, focus areas) rather
// than the generic marketing copy — hand-authored per-tenant, hardcoded English
// (no next-intl namespace): this is one ministry's own copy, not a translatable
// platform surface, so a new i18n namespace would be pure overhead.
//
// **Restructured 2026-08-07** alongside <Landing/>, against the same spoorpet.com
// brief: the product shown in CSS phone frames, a band of capability tiles, the
// founders as the trust anchor, an objection-first FAQ, and one email capture
// below sign-in. The sections themselves are shared components; only the words
// here are the ministry's.
const PUBLIC_LINK =
  "https://ywampotch.my-course.app/share/997211aaa328aa8e9a94fd20dc4c7369703b1f32aaa21ae88a89e64f8dd29348";

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

// The two phone frames, in the ministry's own words: a Prophetic School lesson,
// and a check inside it. The words are the ones the reader actually shows —
// lesson title, section heading, prose, the verse pull-out — because a frame full
// of grey bars advertises a mockup rather than the course (2026-08-18).
//
// **No third "ask" frame.** The reader's Q&A is real, but on a course that's
// already written the questions arrive rarely, and a landing page that leads with
// an answer service promises a conversation the Guest mostly won't have. The
// `askCta`/`asked*` fields are what the shared row would need for it, and are
// deliberately left off — bar the `asked*` trio the type still requires.
const PHONE_COPY: PhoneMockCopy = {
  courseTitle: "Prophetic School",
  lessonProgress: "Lesson 4 of 12",
  lessonTitle: "Testing what you hear",
  nextLesson: "Next lesson",
  lessonSection: "Weighing a word",
  lessonBody: [
    "Hearing God is not the end of the matter — what you do with what you heard is. Scripture never asks you to accept a word because of who carried it, or how strongly it landed.",
    "So we test. Not to be suspicious of God, but because a word that survives testing can be trusted, and one that doesn't has cost you nothing.",
  ],
  verse: "“Do not treat prophecies with contempt but test them all; hold on to what is good.” — 1 Thessalonians 5:20–21",
  quizQuestion: "What does it mean to test a prophetic word?",
  quizOptions: [
    "Weigh it against Scripture",
    "Act on it immediately",
    "Keep it to yourself",
  ],
  quizFeedback: "That's it — Scripture is the measure a word is held against, never the other way round.",
  askedQuestion: "How do I know it's God's voice and not my own?",
  askedReply: "A fair question, and the honest answer starts with Scripture.",
  askedFollowUp: "And if I get it wrong?",
};

// Capabilities, not traction numbers — the same discipline as the shared landing,
// and the reason the band works on a page with no crowd yet.
const TILES: CapabilityTile[] = [
  { v: "2013", l: "Serving from Potchefstroom" },
  { v: "3", l: "Ministries on the base" },
  { v: "1:1", l: "Ask mid-lesson, answered inline" },
  { v: "SA", l: "Local, and sent out" },
];

// Objection first. The hardest question about a self-paced ministry course is
// whether it replaces the base, so that is question one.
const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Does the course replace coming to the base?",
    a: "No, and it isn't meant to. Prophetic School as a course is for whoever can't be in Potchefstroom — a different town, a different country, a season that won't allow it. If you can come, come; the course is for the rest of the time.",
  },
  {
    q: "Do I need to be part of YWAM to do it?",
    a: "No. It's open to anyone who wants to grow in hearing God's voice, whatever church you're part of or aren't.",
  },
  {
    q: "How long does it take?",
    a: "As long as you need. It's self-paced: the next lesson is written when you finish the last one, so it moves at whatever speed your week allows rather than to a timetable.",
  },
  {
    q: "Can I do it on my phone?",
    a: "Yes. Lessons, the questions inside them, and asking your own are all built for a phone first — which is the device most people actually study on.",
  },
  {
    q: "What if I have a question mid-lesson?",
    a: "Ask it right there. It's answered inline, in the lesson where you asked it, so the answer stays attached to the thing that prompted it.",
  },
];

const INTEREST_COPY: InterestFormCopy = {
  heading: "Not ready to start yet?",
  body: "Leave your address and we'll let you know as new schools and courses open. One field, and we won't crowd your inbox.",
  placeholder: "you@email.com",
  submit: "Keep me posted",
  submitting: "Adding you…",
  invalid: "That doesn't look like an address we could reach you at.",
  failed: "That didn't go through. Please try again.",
  doneTitle: "You're on the list.",
  doneBody: "We'll write when there's a school or a course worth telling you about — and never hand your address to anyone else.",
  fieldLabel: "Email address",
};

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
              className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              Get Prophetic School
            </a>
            <a
              href="#focus"
              className="rounded-lg border border-line bg-card px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-accent"
            >
              Our focus areas
            </a>
          </div>
        </div>
      </header>

      {/* ── The softer ask (ADR 0028), at the TOP by the ministry's call
             (2026-08-18). ADR 0028 argued for it below sign-in, on the grounds
             that a visitor who scrolled past sign-in has told us they're not
             ready — that reasoning still holds for the shared landing, which is
             unchanged. Here the address is wanted from the visitor who never
             scrolls, so it sits directly under the hero, and is tagged
             `ywampotch-hero` so the two placements stay comparable. Still exactly
             ONE form on the page: two would mean two places a half-typed address
             can be stranded. ── */}
      <section className="border-b border-line bg-card/60">
        <div className="mx-auto w-full max-w-xl px-6 py-12">
          <InterestForm source="ywampotch-hero" copy={INTEREST_COPY} />
        </div>
      </section>

      {/* ── Focus areas ── */}
      <section id="focus" className="mx-auto w-full max-w-5xl scroll-mt-8 px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Evangelism. Training. Mercy.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-soft">
          Founded in 2013 by Wikus and Christien Vorster, our base currently focuses on three ministries.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {FOCUS_AREAS.map((f, i) => (
            <div
              key={f.title}
              className={`${["land-reveal", "land-reveal-mid", "land-reveal-late"][i]} rounded-lg border border-line bg-card p-6 shadow-sm transition-colors hover:border-gold/60`}
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

      {/* ── Prophetic School — the buy CTA. Replaced the lone 40×40 award medallion
             that used to sit beside it: an icon the size of a dinner plate said
             nothing about what you get, where the phone frames below show it. ── */}
      <section className="border-y border-line bg-card/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <div className="land-reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent2">Prophetic School</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Growing in the Holy Spirit
            </h2>
            <p className="mt-4 leading-relaxed text-soft">
              A self-paced course to help you hear God's voice with confidence and grow in prophetic
              ministry — study anywhere, at your own pace, and ask your questions as they come.
            </p>
            <a
              href={PUBLIC_LINK}
              className="mt-6 inline-flex rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              Get the course
            </a>
          </div>
          <PhoneMockRow
            copy={PHONE_COPY}
            captions={[
              {
                title: "A lesson you can sit with",
                body: "Teaching, Scripture and worked examples on one page, written to be read rather than watched.",
              },
              {
                title: "Checks that make it stick",
                body: "Short questions inside the lesson, marked as you go, so you notice what hasn't landed yet.",
              },
            ]}
          />
        </div>
      </section>

      {/* ── Capability tiles ── */}
      <CapabilityBand
        heading="A base in Potchefstroom, a course that travels"
        body="Trained and sent from the North West since 2013 — and now teaching wherever there's a phone and a reason to grow."
        tiles={TILES}
      />

      {/* ── The founders, as the trust anchor ── */}
      <FounderQuote
        quote="“We started YWAM Potch in 2013 with a conviction that hearing God's voice isn't reserved for a few people with a platform. It's your creation design. Most of what we do is helping someone hear it for the first time and then believe what they heard.”"
        byline="Wikus and Christien Vorster, founders, YWAM Potchefstroom"
      />

      {/* ── FAQ, hardest objection first ── */}
      <section className="mx-auto w-full max-w-3xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Questions, answered.</h2>
        <Faq items={FAQ_ITEMS} />
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

      <p className="mx-auto max-w-5xl px-6 pb-4 text-center text-xs text-soft">
        Questions? Reach us at{" "}
        <a href="mailto:ywampotch@gmail.com" className="hover:text-accent">
          ywampotch@gmail.com
        </a>
      </p>

      <SiteFooter />
    </div>
  );
}
