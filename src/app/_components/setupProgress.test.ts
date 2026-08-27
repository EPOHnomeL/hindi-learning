import { describe, expect, it } from "vitest";
import {
  EXPECTED_SETUP_MS,
  SETUP_STAGES,
  formatElapsed,
  setupPercent,
  setupStageIndex,
  setupView,
} from "./setupProgress";

const MIN = 60 * 1000;

describe("setupStageIndex", () => {
  it("walks the stages in order as the run goes on", () => {
    expect(setupStageIndex(0)).toBe(0);
    expect(setupStageIndex(30 * 1000)).toBe(0);
    expect(setupStageIndex(2 * MIN)).toBe(1);
    expect(setupStageIndex(4 * MIN)).toBe(2);
    expect(setupStageIndex(6 * MIN)).toBe(3);
    expect(setupStageIndex(9 * MIN)).toBe(4);
  });

  it("enters a stage exactly on its boundary", () => {
    for (const [i, stage] of SETUP_STAGES.entries()) {
      expect(setupStageIndex(stage.startsAt)).toBe(i);
    }
  });

  it("clamps at both ends", () => {
    // Server/browser clock skew can make elapsed negative; that is the first
    // stage, never an index of -1 into the copy.
    expect(setupStageIndex(-5000)).toBe(0);
    // An overrunning run holds the last stage rather than walking off the list.
    expect(setupStageIndex(60 * MIN)).toBe(SETUP_STAGES.length - 1);
  });
});

describe("setupPercent", () => {
  it("is 0 at the start and rises linearly to 90 across the expected window", () => {
    expect(setupPercent(0)).toBe(0);
    expect(setupPercent(-1000)).toBe(0);
    expect(setupPercent(EXPECTED_SETUP_MS / 2)).toBeCloseTo(45, 5);
    expect(setupPercent(EXPECTED_SETUP_MS * 0.9)).toBeCloseTo(81, 5);
  });

  it("keeps moving on overrun but never reaches 100", () => {
    // A frozen bar reads as a hung page, so the last 10 points creep: each further
    // expected window halves what is left.
    expect(setupPercent(EXPECTED_SETUP_MS)).toBeCloseTo(90, 5);
    expect(setupPercent(EXPECTED_SETUP_MS * 2)).toBeCloseTo(95, 5);
    expect(setupPercent(EXPECTED_SETUP_MS * 3)).toBeCloseTo(97.5, 5);
    expect(setupPercent(EXPECTED_SETUP_MS * 100)).toBeLessThan(100);
  });

  it("never goes backwards", () => {
    let prev = -1;
    for (let ms = 0; ms < EXPECTED_SETUP_MS * 4; ms += 5000) {
      const pct = setupPercent(ms);
      expect(pct).toBeGreaterThanOrEqual(prev);
      prev = pct;
    }
  });
});

describe("setupView", () => {
  const started = 1_000_000;

  it("is queued when nothing is running", () => {
    // No lock row at all (the fire never landed), and the shapes that mean a
    // previous run ended without producing a lesson.
    expect(setupView(null, started)).toEqual({ kind: "queued" });
    expect(setupView({ status: "idle", startedAt: null, error: null }, started)).toEqual({ kind: "queued" });
    expect(setupView({ status: "caughtUp", startedAt: started, error: null }, started)).toEqual({ kind: "queued" });
  });

  it("is loading, NOT queued, while the query is unresolved", () => {
    // These must not collapse: "queued" paints a start button, so treating an
    // unresolved query as queued flashed "Ready to set up" over a course that was
    // already generating.
    expect(setupView(undefined, started)).toEqual({ kind: "loading" });
  });

  it("is working inside the expected window, with a live stage and percent", () => {
    const view = setupView({ status: "generating", startedAt: started, error: null }, started + 4 * MIN);
    expect(view).toMatchObject({ kind: "working", stageIndex: 2, elapsedMs: 4 * MIN });
    expect(view.kind === "working" && view.percent).toBeCloseTo(36, 5);
  });

  it("flips to slow at the expected window, so the pane can offer a restart", () => {
    const gen = { status: "generating" as const, startedAt: started, error: null };
    expect(setupView(gen, started + EXPECTED_SETUP_MS - 1).kind).toBe("working");
    // Exactly at the window: the backend now considers this lock stale and will let
    // a fresh fire take it, so the pane stops promising and offers the retry.
    expect(setupView(gen, started + EXPECTED_SETUP_MS).kind).toBe("slow");
    expect(setupView(gen, started + 40 * MIN)).toMatchObject({ kind: "slow", stageIndex: SETUP_STAGES.length - 1 });
  });

  it("surfaces a failure and its message instead of spinning forever", () => {
    expect(setupView({ status: "failed", startedAt: started, error: "no api key" }, started + MIN)).toEqual({
      kind: "failed",
      error: "no api key",
    });
    // A failure with no message is still a failure, not a spinner.
    expect(setupView({ status: "failed", startedAt: null, error: null }, started)).toEqual({ kind: "failed", error: null });
  });

  it("treats a start-less running lock as queued rather than narrating off a null", () => {
    expect(setupView({ status: "generating", startedAt: null, error: null }, started)).toEqual({ kind: "queued" });
  });

  it("clamps elapsed to zero when the server clock is ahead of the browser", () => {
    expect(setupView({ status: "generating", startedAt: started, error: null }, started - 30 * 1000)).toMatchObject({
      kind: "working",
      elapsedMs: 0,
      percent: 0,
    });
  });
});

describe("formatElapsed", () => {
  it("renders m:ss with padded seconds and unpadded minutes", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(9 * 1000)).toBe("0:09");
    expect(formatElapsed(65 * 1000)).toBe("1:05");
    expect(formatElapsed(10 * MIN)).toBe("10:00");
    expect(formatElapsed(-5000)).toBe("0:00");
  });
});
