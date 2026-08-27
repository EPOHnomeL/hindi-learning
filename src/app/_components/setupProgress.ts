// Pure derivations behind the course setup pane (the screen an owner sits on
// between seeding a course and Lesson 1 landing). No React, no DOM, so it runs in
// the edge-runtime test environment beside the other *Derive modules.
//
// The honest-progress problem this solves: the backend stores NO setup progress.
// The `generation` lock row carries a coarse status plus `startedAt`, and that is
// all (there is no percent, no step list, and nothing reports mid-run). A pane
// that showed a made-up "62%" would be inventing data. What it CAN show truthfully
// is elapsed time against the known typical duration, so every number here is
// derived from `startedAt` and is labelled in the UI as an estimate.

// How long setup typically takes. Deliberately the same 10 minutes as the
// routine's `STALE_MS`: past that window the backend itself treats the lock as
// crashed and lets a fresh fire steal it, so it is exactly the point where the
// pane should stop saying "nearly there" and offer to restart. If STALE_MS moves,
// move this with it.
export const EXPECTED_SETUP_MS = 10 * 60 * 1000;

// The named stages, in order, with the elapsed-time point each one starts at.
// These are a narration of the authoring run's real shape (read the resources,
// draft the mission, plan the curriculum, write lesson 1), NOT reports from it:
// nothing calls back mid-run, so the boundaries are estimates from the typical
// 10-minute run. `key` is the message-catalogue suffix; the copy lives in
// messages/*.json under Reader.setupStage*.
export const SETUP_STAGES = [
  { key: "reading", startsAt: 0 },
  { key: "mission", startsAt: 90 * 1000 },
  { key: "planning", startsAt: 3 * 60 * 1000 },
  { key: "writing", startsAt: 5 * 60 * 1000 },
  { key: "polishing", startsAt: 8.5 * 60 * 1000 },
] as const;

export type SetupStageKey = (typeof SETUP_STAGES)[number]["key"];

// Which stage the run is narrating at this elapsed time. Clamps at both ends: a
// negative elapsed (clock skew between the server's `startedAt` and the browser)
// reads as the first stage rather than -1, and an overrunning run holds on the
// last stage rather than walking off the end of the list.
export function setupStageIndex(elapsedMs: number): number {
  let index = 0;
  for (let i = 0; i < SETUP_STAGES.length; i++) {
    if (elapsedMs >= SETUP_STAGES[i]!.startsAt) index = i;
  }
  return index;
}

// The progress bar's fill, 0 to 100. Linear to 90% across the expected window,
// then asymptotic: each further expected-window's worth of overrun halves the
// remaining 10 points. So it moves at a believable pace, keeps moving when a run
// overruns (a frozen bar reads as a hung page), and never reaches 100 while the
// pane is still up, because the only thing that legitimately means "done" is a
// lesson arriving and the pane redirecting itself away.
//
// The ceiling is applied explicitly rather than left to the curve: `0.5 ** n`
// underflows to 0 in float once the overrun is large enough (around 50 windows,
// i.e. a lock left running for hours), at which point the "asymptotic" form
// returns exactly 100. Clamping makes the never-100 promise hold by construction.
const MAX_PERCENT = 99;

export function setupPercent(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs < EXPECTED_SETUP_MS) return (elapsedMs / EXPECTED_SETUP_MS) * 90;
  const overruns = (elapsedMs - EXPECTED_SETUP_MS) / EXPECTED_SETUP_MS;
  return Math.min(MAX_PERCENT, 100 - 10 * Math.pow(0.5, overruns));
}

// What the pane should render. A closed set, so the component is a switch over
// these shapes and holds no decisions of its own.
export type SetupView =
  // The lock row hasn't arrived yet. Distinct from "queued" on purpose: the two
  // look nothing alike on screen, and collapsing them made an actively-generating
  // course flash "Ready to set up", complete with a start button, for the beat
  // before the query resolved.
  | { kind: "loading" }
  // Nothing is running: the fire never landed, or a previous run ended without
  // producing a lesson. The pane offers "Set up now" and waits.
  | { kind: "queued" }
  // A run is in flight and inside its expected window.
  | { kind: "working"; stageIndex: number; percent: number; elapsedMs: number }
  // In flight but past the expected window. Same narration, plus the option to
  // restart, which the backend will honour: past STALE_MS a fresh fire can take
  // the lock from the one that is apparently stuck.
  | { kind: "slow"; stageIndex: number; percent: number; elapsedMs: number }
  // The run ended badly and said why. Surfacing the message beats a spinner that
  // never resolves.
  | { kind: "failed"; error: string | null };

// The lock row as the reader's `routine.generationStatus` query returns it, narrowed
// to the fields this pane reads.
type GenerationLite = {
  status: "idle" | "generating" | "failed" | "caughtUp";
  startedAt: number | null;
  error: string | null;
};

// The single decision. `now` is passed in rather than read from the clock so the
// caller owns the ticking (and the tests own time).
//
// `generating` with no `startedAt` is treated as queued, not working: without a
// start there is no elapsed time, so there is nothing honest to narrate. That
// shape shouldn't occur (the lock is always stamped when armed) but it is the one
// case that could otherwise render a stage sequence off `now - null`.
//
// `undefined` is the query still loading; `null` is a resolved "no lock row".
export function setupView(gen: GenerationLite | null | undefined, now: number): SetupView {
  if (gen === undefined) return { kind: "loading" };
  if (gen === null) return { kind: "queued" };
  if (gen.status === "failed") return { kind: "failed", error: gen.error };
  if (gen.status !== "generating" || gen.startedAt === null) return { kind: "queued" };
  const elapsedMs = Math.max(0, now - gen.startedAt);
  const shape = {
    stageIndex: setupStageIndex(elapsedMs),
    percent: setupPercent(elapsedMs),
    elapsedMs,
  };
  return elapsedMs >= EXPECTED_SETUP_MS ? { kind: "slow", ...shape } : { kind: "working", ...shape };
}

// Elapsed time as "m:ss", for the small counter under the bar. Minutes are not
// zero-padded (a leading "0" reads as a stopwatch, and this is a wait), seconds
// always are. Guards against a negative from clock skew.
export function formatElapsed(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
