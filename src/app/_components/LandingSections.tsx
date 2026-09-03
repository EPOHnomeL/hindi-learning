"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./icons";

// The three copy-driven landing sections both pages share (spoorpet.com brief,
// 2026-08-07): an objection-first FAQ, a band of capability tiles, and a founder
// quote. All three take their copy as props and hold no copy of their own — the
// default landing resolves it through next-intl and YwamPotch.tsx hands over
// hand-authored English, and neither needs the other's.
//
// They live in one file because they are one idea (the trust half of a landing
// page) and none is big enough to earn its own module; splitting them would mean
// three imports at every call site for no gain.

// ── FAQ ─────────────────────────────────────────────────────────────────────
// An accordion, not a wall of open text. The brief's version answers the hardest
// objection FIRST — "Is Spoor Pet available yet?" / "Not yet." — which is the
// whole reason a FAQ converts rather than reassures. Callers are expected to keep
// that order.
//
// One item open at a time and NONE open initially: an accordion with a pre-opened
// first item is just a paragraph wearing a button.
export type FaqItem = { q: string; a: string };

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mt-10 divide-y divide-line border-y border-line">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-5 text-start transition-colors hover:text-accent"
            >
              <span className="font-medium text-ink">{item.q}</span>
              {/* One chevron, rotated — not a swapped plus/minus pair, which needs
                  a second icon to say the same thing. */}
              <Icon
                name="chevron"
                className={`h-4 w-4 shrink-0 text-soft transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && <p className="-mt-1 pb-5 pe-8 text-sm leading-relaxed text-soft">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Capability tiles ────────────────────────────────────────────────────────
// The brief's "stat band" is `24/7 · GPS · Weeks · SA` — which is worth noticing
// is NOT traction numbers. They are capability tiles, so the section carries
// weight on a page with no users yet and nothing here has to be a metric we'd
// have to keep true. Keep it that way: a real growth number belongs somewhere it
// can be updated, not baked into a landing page.
export type CapabilityTile = { v: string; l: string };

export function CapabilityBand({ heading, body, tiles }: { heading: string; body: string; tiles: CapabilityTile[] }) {
  return (
    <section className="border-y border-line bg-card/60">
      <div className="mx-auto w-full max-w-5xl px-6 py-20">
        <div className="land-reveal mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{heading}</h2>
          <p className="mt-3 leading-relaxed text-soft">{body}</p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {tiles.map((tile, i) => (
            <div
              key={tile.l}
              // Staggered across the row (globals.css), so four tiles arrive as a
              // sweep rather than a block.
              className={`${["land-reveal", "land-reveal-mid", "land-reveal-late", "land-reveal-late"][i]} rounded-lg border border-line bg-card px-4 py-6 text-center`}
            >
              <div className="text-2xl font-semibold tracking-tight text-accent sm:text-3xl">{tile.v}</div>
              <div className="mt-2 text-xs leading-snug text-soft">{tile.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Founder quote ───────────────────────────────────────────────────────────
// The trust anchor. What makes the brief's version work is a specific, unglamorous
// detail — two dachshunds, and not wanting to line the house with cameras — so a
// caller passing polished mission-statement prose here is wasting the section.
//
// `aside` is whatever sits beside the quote: a photo, or an emblem when there
// isn't one. Optional, because a quote with no portrait is better than a stock
// photograph of somebody who isn't the founder.
export function FounderQuote({ quote, byline, aside }: { quote: string; byline: string; aside?: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20">
      <div className={`land-reveal grid items-center gap-10 ${aside ? "lg:grid-cols-[minmax(0,18rem)_1fr]" : ""}`}>
        {aside && <div className="mx-auto w-full max-w-xs">{aside}</div>}
        <div>
          {/* A blockquote, and the quote marks are in the copy — so a translator
              can use the ones their language actually uses. */}
          <blockquote className="text-lg leading-relaxed text-ink sm:text-xl">{quote}</blockquote>
          <div className="mt-5 text-sm font-medium text-accent2">{byline}</div>
        </div>
      </div>
    </section>
  );
}
