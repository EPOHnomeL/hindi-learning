"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BOUNCY_FLICK, VELOCITY_WINDOW_MS, decideDismiss, releaseVelocity, sheetOffset, type DragSample } from "./drawerDrag";
import { createSpring, type Spring } from "./spring";

// The one drawer gesture, shared by both readers (fluid-interface 03,
// 2026-09-18). The sheet is a `fixed bottom-0` aside that is static from `md`
// up; below `md` this hook owns its transform: 1:1 under the finger, on a spring
// the rest of the time. Open and close ride the same spring, so a grab
// mid-flight starts from wherever the sheet actually is, and a release hands the
// finger's velocity to the spring so the motion continues instead of restarting.
//
// Position is `y` in px from rest: 0 is open, the sheet's height is hidden,
// negative is above rest (rubber-banded). Nothing per frame goes through React;
// the spring writes `style.transform` on the aside and `style.opacity` on the
// scrim directly. While the sheet is parked shut, the inline styles are cleared
// so the aside's own `translate-y-full` class hides it, which also covers the
// pre-hydration paint and keeps the hidden position independent of the sheet's
// height (the lesson list grows as queries land).

const SCRIM_OPACITY = 0.4;
const BOUNCY_DAMPING = 0.8;
// Tailwind's `md` breakpoint (48rem at a 16px root). From here up the aside is
// a static sidebar and must carry no transform at all.
const DESKTOP = "(min-width: 768px)";
const desktop = () => typeof matchMedia === "function" && matchMedia(DESKTOP).matches;

type Grab = { startY: number; from: number; samples: DragSample[] };

export function useSheetDrag(open: boolean, setOpen: (open: boolean) => void) {
  const sheetRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  // True while the spring is in flight or a finger is down: the scrim stays
  // mounted for the whole of a close so its fade can follow the sheet out.
  const [settling, setSettling] = useState(false);
  const springRef = useRef<Spring | null>(null);
  const grab = useRef<Grab | null>(null);
  // Sheet height measured when a flight or grab begins, so frames don't read layout.
  const heightRef = useRef(1);
  // Parked: shut, class-driven, no inline transform (see head comment).
  const parked = useRef(true);
  // Where the spring was last sent, so the open/close effect does not restart a
  // flight the release handler already began with the finger's velocity.
  const targetRef = useRef<number | null>(null);

  function paintScrim(y: number) {
    const scrim = scrimRef.current;
    if (!scrim) return;
    const progress = Math.min(1, Math.max(0, 1 - y / heightRef.current));
    scrim.style.opacity = String(SCRIM_OPACITY * progress);
  }

  function paint(y: number) {
    const el = sheetRef.current;
    if (!el) return;
    el.style.translate = "none";
    el.style.transform = `translateY(${y}px)`;
    paintScrim(y);
  }

  function park() {
    const el = sheetRef.current;
    if (el) {
      el.style.transform = "";
      el.style.translate = "";
    }
    parked.current = true;
    targetRef.current = null;
    paintScrim(heightRef.current);
  }

  function spring(): Spring {
    return (springRef.current ??= createSpring({
      onFrame: paint,
      onRest: () => {
        if (springRef.current!.current() > 0) park();
        setSettling(false);
      },
    }));
  }

  function measure() {
    return (heightRef.current = Math.max(1, sheetRef.current?.offsetHeight ?? 1));
  }

  // Take over from the parked class, if need be, so the spring starts from the
  // hidden position in px rather than from a stale value.
  function unpark() {
    if (!parked.current) return;
    parked.current = false;
    spring().set(heightRef.current);
  }

  function fly(target: number, opts?: { velocity?: number; damping?: number }) {
    unpark();
    targetRef.current = target;
    setSettling(true);
    spring().animateTo(target, opts);
  }

  // Put the sheet where `open` says with no animation: at rest, or parked.
  function place(isOpen: boolean) {
    spring().stop();
    grab.current = null;
    setSettling(false);
    if (isOpen && !desktop()) {
      measure();
      parked.current = false;
      targetRef.current = 0;
      spring().set(0);
    } else {
      park();
    }
  }

  // Open and close follow `open`, along the same path a drag takes.
  useEffect(() => {
    if (!sheetRef.current || desktop()) return;
    const h = measure();
    const y = open ? 0 : h;
    if (!open && parked.current) return;
    if (targetRef.current === y) return;
    fly(y);
  }, [open]);

  // First paint: an initially open sheet sits at rest; a shut one is parked by
  // its class already. And the breakpoint: crossing to desktop clears every
  // inline style so the static sidebar carries no transform; crossing back
  // re-places the sheet where `open` says. Mount-only, so it never interrupts
  // an open or close in flight; `openRef` is how it reads the live `open`.
  const openRef = useRef(open);
  openRef.current = open;
  useLayoutEffect(() => {
    if (open) place(true);
    const mq = matchMedia(DESKTOP);
    const onChange = () => place(openRef.current);
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      springRef.current?.stop();
    };
  }, []);

  // The scrim mounts a render after the flight starts (and, under reduced
  // motion, after the spring has already landed), so paint it once it exists.
  const scrimMounted = open || settling;
  useLayoutEffect(() => {
    if (scrimMounted) paintScrim(parked.current ? heightRef.current : spring().current());
  }, [scrimMounted]);

  const handle = {
    onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
      if (!sheetRef.current || desktop()) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const s = spring();
      s.stop();
      measure();
      unpark();
      grab.current = { startY: e.clientY, from: s.current(), samples: [{ y: e.clientY, t: e.timeStamp }] };
      setSettling(true);
    },
    onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
      const g = grab.current;
      if (!g) return;
      spring().set(sheetOffset(g.startY, e.clientY, heightRef.current, g.from));
      g.samples.push({ y: e.clientY, t: e.timeStamp });
      while (g.samples.length > 2 && e.timeStamp - g.samples[0]!.t > VELOCITY_WINDOW_MS) g.samples.shift();
    },
    onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
      const g = grab.current;
      if (!g) return;
      grab.current = null;
      g.samples.push({ y: e.clientY, t: e.timeStamp });
      const velocity = releaseVelocity(g.samples);
      const dismiss = decideDismiss(spring().current(), heightRef.current, velocity);
      fly(dismiss ? heightRef.current : 0, { velocity, damping: Math.abs(velocity) > BOUNCY_FLICK ? BOUNCY_DAMPING : 1 });
      setOpen(!dismiss);
    },
    onPointerCancel() {
      if (!grab.current) return;
      grab.current = null;
      fly(open ? 0 : heightRef.current);
    },
  };

  return { sheetRef, scrimRef, scrimMounted, handle };
}
