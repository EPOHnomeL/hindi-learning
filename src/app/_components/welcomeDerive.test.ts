import { describe, expect, it } from "vitest";
import { resumeLessonKey } from "./readerDerive";
import { guestProgress, latchFirstOpen, missionExcerpt } from "./welcomeDerive";

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
  it("strips heading markers, keeping the heading's words", () => {
    expect(missionExcerpt("# Mission: read Premchand")).toBe("Mission: read Premchand");
    expect(missionExcerpt("###### Deeply nested")).toBe("Deeply nested");
    expect(missionExcerpt("# Why I read\n\n## In the original")).toBe("Why I read In the original");
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
    expect(latchFirstOpen(null, undefined)).toBe(null);
  });

  it("decides true on an empty progress list — nothing opened, nothing completed", () => {
    expect(latchFirstOpen(null, [])).toBe(true);
  });

  it("decides false once any progress exists", () => {
    expect(latchFirstOpen(null, opened)).toBe(false);
    expect(latchFirstOpen(null, [{ lessonKey: "0001-alpha", status: "completed" as const }])).toBe(false);
  });

  // The load-bearing case: rendering a lesson immediately writes an `opened` row
  // (ArtifactView), and progress is a live query — so an unlatched predicate would
  // flip to false and yank the panel out from under the reader mid-sentence.
  it("keeps a true verdict after the reader's own `opened` row lands", () => {
    expect(latchFirstOpen(true, opened)).toBe(true);
  });

  it("never revisits a false verdict, even if progress empties out", () => {
    expect(latchFirstOpen(false, [])).toBe(false);
    expect(latchFirstOpen(false, undefined)).toBe(false);
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
