import { expect, test } from "vitest";
import { createSpring, settled, step } from "./spring";

// Run the pure integrator at 60fps for `seconds`, collecting every value.
function run(target: number, seconds: number, config?: { damping?: number; response?: number }, start = { value: 0, velocity: 0 }) {
  const values: number[] = [];
  let state = start;
  for (let i = 0; i < seconds * 60; i++) {
    state = step(state, target, 1 / 60, config);
    values.push(state.value);
  }
  return { state, values };
}

test("a critically damped spring reaches its target within about a second and never overshoots", () => {
  const { state, values } = run(100, 1);
  expect(Math.abs(state.value - 100)).toBeLessThan(0.5);
  expect(Math.abs(state.velocity)).toBeLessThan(5);
  // Damping 1.0 is the no-bounce setting: the value climbs and stops.
  expect(Math.max(...values)).toBeLessThanOrEqual(100 + 1e-6);
  for (let i = 1; i < values.length; i++) expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]! - 1e-6);
});

test("an underdamped spring overshoots, then settles", () => {
  const { state, values } = run(100, 1.5, { damping: 0.8 });
  expect(Math.max(...values)).toBeGreaterThan(100);
  expect(Math.abs(state.value - 100)).toBeLessThan(0.5);
});

test("response is the time scale: a shorter response gets there sooner", () => {
  const quick = run(100, 0.25, { response: 0.15 }).state.value;
  const slow = run(100, 0.25, { response: 0.6 }).state.value;
  expect(quick).toBeGreaterThan(slow);
});

test("initial velocity carries the value in its own direction first, even against the target", () => {
  // Flung downward (positive) while the target is above (0): the first frames
  // keep travelling down before the spring pulls back. That is what makes a
  // release feel continuous with the finger instead of snapping.
  const first = step({ value: 50, velocity: 1500 }, 0, 1 / 60);
  expect(first.value).toBeGreaterThan(50);
});

test("retargeting continues from the live state, not from the start", () => {
  // Half-way to 100, the target flips to 0. The next frame must start from the
  // mid-flight value and velocity, so nothing jumps.
  const mid = run(100, 0.1).state;
  expect(mid.value).toBeGreaterThan(10);
  const next = step(mid, 0, 1 / 60);
  // Momentum still points toward 100 for a frame; the value keeps rising a touch.
  expect(next.value).toBeGreaterThan(mid.value);
  const { state } = run(0, 1.5, undefined, mid);
  expect(Math.abs(state.value)).toBeLessThan(0.5);
});

test("a large frame gap is integrated stably rather than exploding", () => {
  const state = step({ value: 0, velocity: 0 }, 100, 0.5);
  expect(state.value).toBeGreaterThan(0);
  expect(state.value).toBeLessThanOrEqual(100 + 1e-6);
});

test("settled means within half a pixel and nearly still", () => {
  expect(settled({ value: 99.8, velocity: 1 }, 100)).toBe(true);
  expect(settled({ value: 98, velocity: 0 }, 100)).toBe(false);
  expect(settled({ value: 100, velocity: 200 }, 100)).toBe(false);
});

// A fake frame clock: `tick(ms)` advances time and fires the one pending frame.
function fakeFrames() {
  let now = 0;
  let pending: ((t: number) => void) | null = null;
  let nextId = 1;
  return {
    raf: (cb: (t: number) => void) => {
      pending = cb;
      return nextId++;
    },
    caf: () => {
      pending = null;
    },
    now: () => now,
    tick(ms: number) {
      now += ms;
      const cb = pending;
      pending = null;
      cb?.(now);
    },
    hasPending: () => pending !== null,
  };
}

test("createSpring drives onFrame each frame and reports rest once", () => {
  const frames = fakeFrames();
  const seen: number[] = [];
  let rested = 0;
  const spring = createSpring({
    onFrame: (v) => seen.push(v),
    onRest: () => rested++,
    raf: frames.raf,
    caf: frames.caf,
    now: frames.now,
    reducedMotion: () => false,
  });
  spring.animateTo(100);
  expect(frames.hasPending()).toBe(true);
  for (let i = 0; i < 120 && frames.hasPending(); i++) frames.tick(16);
  expect(seen.length).toBeGreaterThan(5);
  expect(seen.at(-1)).toBe(100);
  expect(spring.current()).toBe(100);
  expect(spring.velocity()).toBe(0);
  expect(rested).toBe(1);
  expect(frames.hasPending()).toBe(false);
});

test("createSpring can be stopped mid-flight and read, then resumed from there", () => {
  const frames = fakeFrames();
  const spring = createSpring({ onFrame: () => {}, raf: frames.raf, caf: frames.caf, now: frames.now, reducedMotion: () => false });
  spring.animateTo(300);
  frames.tick(16);
  frames.tick(16);
  frames.tick(16);
  const mid = spring.current();
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(300);
  spring.stop();
  expect(frames.hasPending()).toBe(false);
  // Nothing moves while stopped.
  frames.tick(16);
  expect(spring.current()).toBe(mid);
  // Retarget from the live value.
  spring.animateTo(0);
  frames.tick(16);
  expect(spring.current()).not.toBe(mid);
});

test("set() places the value at once, kills velocity and paints one frame", () => {
  const frames = fakeFrames();
  const seen: number[] = [];
  const spring = createSpring({ onFrame: (v) => seen.push(v), raf: frames.raf, caf: frames.caf, now: frames.now, reducedMotion: () => false });
  spring.animateTo(100);
  frames.tick(16);
  spring.set(42);
  expect(spring.current()).toBe(42);
  expect(spring.velocity()).toBe(0);
  expect(seen.at(-1)).toBe(42);
  expect(frames.hasPending()).toBe(false);
});

test("animateTo takes a starting velocity, and a per-flight damping", () => {
  const frames = fakeFrames();
  const seen: number[] = [];
  const spring = createSpring({ onFrame: (v) => seen.push(v), raf: frames.raf, caf: frames.caf, now: frames.now, reducedMotion: () => false });
  spring.set(50);
  seen.length = 0;
  // Flung downward, target above: the first frame travels down.
  spring.animateTo(0, { velocity: 1500 });
  frames.tick(16);
  expect(seen[0]!).toBeGreaterThan(50);
  // Bouncy flight overshoots the target at least once.
  spring.set(0);
  seen.length = 0;
  spring.animateTo(100, { damping: 0.8 });
  for (let i = 0; i < 200 && frames.hasPending(); i++) frames.tick(16);
  expect(Math.max(...seen)).toBeGreaterThan(100);
});

test("under reduced motion the spring jumps: one frame at the target, no animation", () => {
  const frames = fakeFrames();
  const seen: number[] = [];
  let rested = 0;
  const spring = createSpring({
    onFrame: (v) => seen.push(v),
    onRest: () => rested++,
    raf: frames.raf,
    caf: frames.caf,
    now: frames.now,
    reducedMotion: () => true,
  });
  spring.animateTo(100, { velocity: 900 });
  expect(seen).toEqual([100]);
  expect(spring.current()).toBe(100);
  expect(spring.velocity()).toBe(0);
  expect(rested).toBe(1);
  expect(frames.hasPending()).toBe(false);
});
