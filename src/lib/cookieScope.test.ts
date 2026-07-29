import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALE_COOKIE } from "../i18n/config";

// The regression net for per-tenant session isolation (ADR 0025). Cookies are
// host-only so each tenant subdomain keeps its own session, language and theme.
// Nothing here asserts the absence of a `Domain` attribute directly — the writers
// are edge middleware and `document.cookie` strings with no unit harness — so this
// pins the two couplings a type checker and a rename tool CANNOT see, which are
// exactly the two that would break silently.
//
// `ThemeContext.tsx` is read as text rather than imported: the test environment
// can't parse JSX (tsconfig keeps `jsx: preserve`), which is why the reader's
// derivation modules are plain `.ts` in the first place.
const themeContext = readFileSync("src/app/_components/ThemeContext.tsx", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const THEME_COOKIE = /export const THEME_COOKIE = "([^"]+)"/.exec(themeContext)?.[1];

describe("cookie names are the post-isolation ones", () => {
  // Trap 1: users still hold `hindi_locale` / `hindi_theme` scoped to
  // `Domain=my-course.app` with a year of max-age. A host-only cookie of the SAME
  // name does not replace a parent-domain one — the browser keeps both and sends
  // both, and `cookies.get()` returns whichever comes first (RFC 6265: path length,
  // then creation time). So the stale cross-tenant value can beat the tenant's own
  // choice forever, and nothing ever deletes it. Reverting either name reintroduces
  // a silent, permanent bug, which is why it's pinned rather than left to review.
  it("never reverts to a legacy name the old parent-domain cookie would shadow", () => {
    expect(LOCALE_COOKIE).toBe("hindi_lang");
    expect(THEME_COOKIE).toBe("hindi_mode");
  });
});

describe("the pre-paint theme script", () => {
  // Trap 3: layout.tsx applies the saved theme before React hydrates, reading the
  // cookie with a regex inside an inline string — invisible to the type checker and
  // to rename tooling. Drift from THEME_COOKIE isn't an error but a flash: every
  // page paints light, then snaps to dark once hydrated.
  it("reads the same cookie name ThemeContext writes", () => {
    expect(THEME_COOKIE).toBeDefined();
    expect(layout).toContain(`${THEME_COOKIE}=(dark|light)`);
  });

  it("carries no stale legacy cookie name", () => {
    expect(layout).not.toContain("hindi_theme");
    expect(themeContext).not.toContain('= "hindi_theme"');
  });
});
