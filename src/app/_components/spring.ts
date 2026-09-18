// A small damped spring on requestAnimationFrame (fluid-interface 03,
// 2026-09-18). One drawer and a handful of dialogs did not justify Motion or
// Framer Motion (map Notes), so this is the whole animation dependency: an
// integrator you can unit-test without a frame clock, and a driver around it
// that owns the rAF loop, retargets from the live value and velocity, and jumps
// straight to the target under `prefers-reduced-motion`.
//
// Parameterised the way Apple does it: `response` is the period in seconds (how
// long the spring takes to get most of the way there) and `damping` the ratio
// (1.0 stops dead, below 1 bounces). Values are in whatever unit the caller
// feeds in, px here; velocity is unit per second.

export type SpringState = { value: number; velocity: number };
export type SpringConfig = { damping?: number; response?: number };

export const DEFAULT_RESPONSE = 0.3;
export const DEFAULT_DAMPING = 1;

// Advance `state` toward `target` by `dt` seconds. Semi-implicit Euler in fixed
// sub-steps, so a long frame gap (a tab that was hidden, a janky first paint)
// integrates stably instead of blowing up.
export function step(state: SpringState, target: number, dt: number, config: SpringConfig = {}): SpringState {
  const damping = config.damping ?? DEFAULT_DAMPING;
  const response = config.response ?? DEFAULT_RESPONSE;
  const omega = (2 * Math.PI) / response;
  let { value, velocity } = state;
  let remaining = dt;
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 240);
    const accel = -omega * omega * (value - target) - 2 * damping * omega * velocity;
    velocity += accel * h;
    value += velocity * h;
    remaining -= h;
  }
  return { value, velocity };
}

// Close enough to stop drawing frames: within half a unit and nearly still.
export function settled(state: SpringState, target: number): boolean {
  return Math.abs(state.value - target) < 0.5 && Math.abs(state.velocity) < 5;
}

export type Spring = {
  // Place the value at once (no animation), zero the velocity, paint one frame.
  set(value: number): void;
  // Head for `target` from wherever the value is now, keeping its velocity
  // unless a fresh one is given. Calling it mid-flight simply retargets.
  animateTo(target: number, opts?: { velocity?: number; damping?: number }): void;
  // Freeze in place. `current()` and `velocity()` then read the frozen state,
  // which is what a re-grab mid-flight starts from.
  stop(): void;
  current(): number;
  velocity(): number;
};

type CreateSpringOptions = SpringConfig & {
  onFrame: (value: number) => void;
  onRest?: () => void;
  // Injectable for tests; default to the browser's.
  raf?: (cb: (t: number) => void) => number;
  caf?: (id: number) => void;
  now?: () => number;
  reducedMotion?: () => boolean;
};

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createSpring(opts: CreateSpringOptions): Spring {
  const raf = opts.raf ?? ((cb) => requestAnimationFrame(cb));
  const caf = opts.caf ?? ((id) => cancelAnimationFrame(id));
  const now = opts.now ?? (() => performance.now());
  const reduced = opts.reducedMotion ?? prefersReducedMotion;
  const response = opts.response ?? DEFAULT_RESPONSE;

  let state: SpringState = { value: 0, velocity: 0 };
  let target = 0;
  let damping = opts.damping ?? DEFAULT_DAMPING;
  let frame: number | null = null;
  let last = 0;

  function stop() {
    if (frame !== null) caf(frame);
    frame = null;
  }

  function land() {
    state = { value: target, velocity: 0 };
    frame = null;
    opts.onFrame(target);
    opts.onRest?.();
  }

  function tick(t: number) {
    // Cap the step: after a hidden tab the animation resumes rather than leaps.
    const dt = Math.min(Math.max(t - last, 0) / 1000, 1 / 30);
    last = t;
    state = step(state, target, dt, { damping, response });
    if (settled(state, target)) return land();
    opts.onFrame(state.value);
    frame = raf(tick);
  }

  return {
    set(value) {
      stop();
      state = { value, velocity: 0 };
      target = value;
      opts.onFrame(value);
    },
    animateTo(next, o) {
      target = next;
      damping = o?.damping ?? opts.damping ?? DEFAULT_DAMPING;
      if (o?.velocity !== undefined) state = { ...state, velocity: o.velocity };
      if (reduced()) {
        stop();
        return land();
      }
      if (frame === null) {
        last = now();
        frame = raf(tick);
      }
    },
    stop,
    current: () => state.value,
    velocity: () => state.velocity,
  };
}
