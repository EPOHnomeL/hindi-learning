// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// The one modal shell (ticket 39's candidate, from the 2026-09-08 walk). Eight
// call sites opened a native `<dialog>` and each repeated the same twelve lines:
// the ref, the `showModal()` on mount, the `onClose`, the
// `e.target === ref.current` backdrop close, and the shell classes.
//
// These are source assertions rather than rendered ones, because the repo has no
// React testing environment (see `mutationRun.test.ts` for that decision). What
// they catch is the thing that actually went wrong here: a sixth hand-rolled
// shell, and a backdrop that drifts.

const SOURCES = import.meta.glob("./**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

// `ArtifactView`'s prose editor is the single deliberate exception, and the
// reason is a behaviour rather than a style: an editor must NOT close on a
// backdrop click, because a stray click beside it would throw away unsaved work.
// `Modal` gives every other modal that close for free.
const EXCEPTIONS = new Set(["./ArtifactView.tsx", "./ui.tsx"]);

test("only ui.tsx opens a native dialog, apart from the one documented exception", () => {
  const offenders = Object.entries(SOURCES)
    .filter(([p]) => !p.includes(".test.") && !EXCEPTIONS.has(p))
    // Anchored to the start of a line, so the several comments that mention
    // `<dialog>` in prose are not mistaken for one being opened.
    .filter(([, s]) => /^\s*<dialog/m.test(s))
    .map(([p]) => p);
  expect(offenders).toEqual([]);
});

test("nothing re-implements the showModal-on-mount dance", () => {
  const offenders = Object.entries(SOURCES)
    .filter(([p]) => !p.includes(".test.") && !EXCEPTIONS.has(p))
    .filter(([, s]) => /showModal\(\)/.test(s))
    .map(([p]) => p);
  expect(offenders).toEqual([]);
});

test("one backdrop, so it cannot drift again", () => {
  // It had already drifted: `black/50` in three shells and `black/40` in the
  // other three, which is what a copied class string does over a year.
  const withBackdrop = Object.entries(SOURCES).filter(([p, s]) => !p.includes(".test.") && /backdrop:bg-/.test(s));
  for (const [path, src] of withBackdrop) {
    const shades = [...src.matchAll(/backdrop:bg-black\/(\d+)/g)].map((m) => m[1]);
    expect(new Set(shades), `${path} must use the one backdrop`).toEqual(new Set(["50"]));
  }
  // And `Modal` is where it is declared, so a caller passing a `shell` cannot
  // set it at all.
  expect(readFileSync("src/app/_components/ui.tsx", "utf8")).toContain("backdrop:bg-black/50 ${shell}");
});

test("ConfirmDialog takes a node body and an extra slot, which is why the twins could go", () => {
  // The interface being too narrow to say "one control above the buttons" is the
  // whole reason `SharingTab`'s retranslate confirm re-implemented the shell.
  const ui = SOURCES["./ui.tsx"]!;
  expect(ui).toContain("body: ReactNode;");
  expect(ui).toContain("extra?: ReactNode;");
});
