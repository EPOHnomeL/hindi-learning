import { describe, expect, it } from "vitest";
import { resumeLessonKey } from "./readerDerive";
import { guestProgress, latchFirstOpen, missionExcerpt, welcomeVariant } from "./welcomeDerive";

// The first-open welcome panel (welcome/01): the derivations behind "here's the
// course, here's how long it is, here's the bit of the mission, here's your next
// lesson" — shared by the authed reader and the Guest reader.

describe("missionExcerpt", () => {
  it("returns a short mission whole, with no ellipsis", () => {
    expect(missionExcerpt("Read Premchand in the original.")).toBe("Read Premchand in the original.");
  });

  it("collapses the authored newlines and runs of spaces into one line", () => {
    expect(missionExcerpt("  Read Premchand\n\nin   the original.  ")).toBe("Read Premchand in the original.");
  });

  it("treats a missing or blank mission as no mission at all", () => {
    expect(missionExcerpt(null)).toBe(null);
    expect(missionExcerpt(undefined)).toBe(null);
    expect(missionExcerpt("")).toBe(null);
    expect(missionExcerpt("   \n  ")).toBe(null);
  });

  // Missions are authored as markdown and the excerpt is plain text, so the syntax
  // has to come off — a mission opening "# Mission: …" rendered its own hash marks
  // into the panel.
  it("excerpts the prose, dropping a heading rather than running it into the sentence below", () => {
    expect(missionExcerpt("# Mission: read Premchand\n\nI want to follow a column unaided.")).toBe(
      "I want to follow a column unaided.",
    );
    expect(missionExcerpt("## Why\n\nBecause the translations flatten him.\n\n## How\n\nSlowly.")).toBe(
      "Because the translations flatten him. Slowly.",
    );
  });

  // All heading, no prose: their words are all there is, so show them rather than
  // rendering the panel with an empty gap.
  it("falls back to the heading's words when a mission is nothing but headings", () => {
    expect(missionExcerpt("# Mission: read Premchand")).toBe("Mission: read Premchand");
    expect(missionExcerpt("###### Deeply nested")).toBe("Deeply nested");
  });

  it("strips emphasis and inline-code markers, keeping the words", () => {
    expect(missionExcerpt("Read **Premchand** in the _original_.")).toBe("Read Premchand in the original.");
    expect(missionExcerpt("Read `Godaan` first.")).toBe("Read Godaan first.");
  });

  it("leaves a hash that isn't a heading marker alone", () => {
    expect(missionExcerpt("Lesson #1 covers C# and #hashtags")).toBe("Lesson #1 covers C# and #hashtags");
  });

  it("treats a mission of nothing but markers as no mission at all", () => {
    expect(missionExcerpt("#")).toBe(null);
    expect(missionExcerpt("## \n # ")).toBe(null);
  });

  it("truncates a long mission on a word boundary and marks the cut", () => {
    const mission =
      "Learn to read Hindi well enough to follow a newspaper column without a dictionary, " +
      "then work up to short stories, and finally read Premchand in the original Devanagari.";
    const out = missionExcerpt(mission, 80)!;
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(81);
    // Word boundary: no half-word left dangling before the ellipsis.
    expect(mission.startsWith(out.slice(0, -1).trimEnd())).toBe(true);
    expect(out.slice(0, -1).trimEnd().endsWith("a")).toBe(true);
  });

  it("hard-cuts a single word longer than the limit (nothing to break on)", () => {
    expect(missionExcerpt("Donaudampfschifffahrtsgesellschaftskapitaenswitwe", 10)).toBe("Donaudampf…");
  });

  it("keeps a mission exactly at the limit intact", () => {
    expect(missionExcerpt("12345", 5)).toBe("12345");
  });
});

describe("latchFirstOpen", () => {
  const opened = [{ lessonKey: "0001-alpha", status: "opened" as const }];

  it("stays undecided while progress is still loading", () => {
    expect(latchFirstOpen(null, undefined, 3)).toBe(null);
  });

  it("stays undecided while the lesson list is still loading", () => {
    expect(latchFirstOpen(null, [], undefined)).toBe(null);
  });

  it("decides true on an empty progress list — nothing opened, nothing completed", () => {
    expect(latchFirstOpen(null, [], 3)).toBe(true);
  });

  it("decides false once any progress exists", () => {
    expect(latchFirstOpen(null, opened, 3)).toBe(false);
    expect(latchFirstOpen(null, [{ lessonKey: "0001-alpha", status: "completed" as const }], 3)).toBe(false);
  });

  // A course with no lessons yet is one still being created — the owner is watching
  // "Preparing your first lesson…", and a welcome panel announcing "0 lessons" with
  // no lesson to start is orientation for something that isn't there.
  it("decides false on a course with no lessons yet", () => {
    expect(latchFirstOpen(null, [], 0)).toBe(false);
  });

  // The load-bearing case: rendering a lesson immediately writes an `opened` row
  // (ArtifactView), and progress is a live query — so an unlatched predicate would
  // flip to false and yank the panel out from under the reader mid-sentence.
  it("keeps a true verdict after the reader's own `opened` row lands", () => {
    expect(latchFirstOpen(true, opened, 3)).toBe(true);
  });

  it("never revisits a false verdict, even if progress empties out", () => {
    expect(latchFirstOpen(false, [], 3)).toBe(false);
    expect(latchFirstOpen(false, undefined, 3)).toBe(false);
  });

  // The same latch, forwards: the course had no lessons when we first looked, so
  // generation landing lesson 1 a moment later must not pop the panel over it.
  it("holds the no-lessons verdict once the first generated lesson arrives", () => {
    expect(latchFirstOpen(false, [], 1)).toBe(false);
  });
});

// The one panel that owns the reader's opening moment (ywampotch-launch 17): the
// generic first-open orientation, OR the card buyer's payment acknowledgement —
// never both, and the purchase always wins, because a buyer who has just moved
// money does not want a course intro.
describe("welcomeVariant", () => {
  const base = {
    purchaseToken: null as string | null,
    checkout: undefined as { state: "awaiting-payment" | "granted" } | null | undefined,
    firstOpen: true as boolean | null,
    dismissed: false,
    onReference: false,
  };

  it("shows the first-open panel to a reader who isn't coming back from a payment", () => {
    expect(welcomeVariant(base)).toBe("first-open");
  });

  it("shows nothing once dismissed, whichever panel it would have been", () => {
    expect(welcomeVariant({ ...base, dismissed: true })).toBe(null);
    expect(welcomeVariant({ ...base, dismissed: true, purchaseToken: "tok", checkout: { state: "granted" } })).toBe(
      null,
    );
  });

  it("shows nothing to a reader who deep-linked to a Reference — they're looking something up", () => {
    expect(welcomeVariant({ ...base, onReference: true })).toBe(null);
  });

  // The whole bug: the ITN normally lands before the browser is back, so this is
  // the HAPPY path and it used to render nothing at all.
  it("acknowledges the purchase when the ITN has already landed", () => {
    expect(welcomeVariant({ ...base, purchaseToken: "tok", checkout: { state: "granted" } })).toBe(
      "purchase-complete",
    );
  });

  it("reassures while the ITN is still in flight, and flips reactively when it lands", () => {
    expect(welcomeVariant({ ...base, purchaseToken: "tok", checkout: { state: "awaiting-payment" } })).toBe(
      "purchase-confirming",
    );
  });

  // Holding until the status resolves costs a beat and buys a clean landing:
  // guessing "confirming" first would flash the wrong state at the buyer whose
  // payment is already done, which is the common case.
  it("stays undecided while the checkout status is still loading", () => {
    expect(welcomeVariant({ ...base, purchaseToken: "tok", checkout: undefined })).toBe(null);
  });

  // The token is a bearer capability off the URL — a stale or mangled one resolves
  // to no intent, and then there is no purchase to acknowledge.
  it("falls back to the first-open panel when the token names no intent", () => {
    expect(welcomeVariant({ ...base, purchaseToken: "stale", checkout: null })).toBe("first-open");
  });

  // A buyer who read the free Preview lesson before paying carries progress, so
  // `firstOpen` is false — the acknowledgement must not hang off it.
  it("acknowledges the purchase even to a reader who already has progress", () => {
    expect(
      welcomeVariant({ ...base, firstOpen: false, purchaseToken: "tok", checkout: { state: "granted" } }),
    ).toBe("purchase-complete");
    expect(
      welcomeVariant({ ...base, firstOpen: null, purchaseToken: "tok", checkout: { state: "granted" } }),
    ).toBe("purchase-complete");
  });

  it("shows nothing while the first-open verdict is still latching", () => {
    expect(welcomeVariant({ ...base, firstOpen: null })).toBe(null);
    expect(welcomeVariant({ ...base, firstOpen: false })).toBe(null);
  });
});

describe("guestProgress", () => {
  const lessons = [
    { key: "0001-alpha", seq: 1, title: "Alpha" },
    { key: "0002-beta", seq: 2, title: "Beta" },
    { key: "0003-gamma", seq: 3, title: "Gamma" },
  ];

  it("adapts a Guest's per-device completed set into progress rows, so resume is shared logic", () => {
    expect(resumeLessonKey(lessons, guestProgress(new Set(["0001-alpha"])))).toBe("0002-beta");
    expect(resumeLessonKey(lessons, guestProgress(new Set()))).toBe("0001-alpha");
  });

  it("marks every key completed — a Guest only ever records finished lessons", () => {
    expect(guestProgress(new Set(["0002-beta"]))).toEqual([{ lessonKey: "0002-beta", status: "completed" }]);
  });
});
