// @vitest-environment node
import { expect, test } from "vitest";
import { coerceImportedTheme, tenantRemovalBlockers, timeAgo, validatePalette } from "./adminDerive";
import { TENANT_THEME_TOKENS } from "../../design/tokens";

// The Admin panel's pure cores (ticket 34). All of this was reachable only by
// rendering a 2660-line component whose single export was the component, so none
// of it had ever been tested: not the palette import with its six distinct
// throws, not the money formatting on ten call sites, and not the blockers that
// gate a destructive button.

const complete = (): Record<string, string> => Object.fromEntries(TENANT_THEME_TOKENS.map((t) => [t, "#000000"]));

// ---- validatePalette: the six refusals, one at a time ---------------------------
//
// Covering them individually is the whole reason this moved. They are the only
// feedback an operator gets on a bad paste, and until now nothing checked that
// any of the six said what it meant.

test("1: a non-object palette is refused by name", () => {
  for (const bad of [null, undefined, "#fff", 42, true]) {
    expect(() => validatePalette(bad, "light", true)).toThrow(/^light must be an object of token to colour\.$/);
  }
});

test("2: an unknown token is refused, and named so the operator can find it", () => {
  expect(() => validatePalette({ ...complete(), nonsense: "#fff" }, "light", true)).toThrow(
    /light has unknown token\(s\): nonsense/,
  );
  // Several at once are all listed, not just the first.
  expect(() => validatePalette({ ...complete(), a: "#fff", b: "#000" }, "light", true)).toThrow(
    /unknown token\(s\): a, b/,
  );
});

test("3: a non-string colour is refused, naming the token", () => {
  const p: Record<string, unknown> = { ...complete() };
  p[TENANT_THEME_TOKENS[0]!] = 16711680;
  expect(() => validatePalette(p, "light", true)).toThrow(
    new RegExp(`light token "${TENANT_THEME_TOKENS[0]}" must be a colour string`),
  );
});

test("4: an incomplete light palette is refused, listing what is missing", () => {
  const p = complete();
  delete p[TENANT_THEME_TOKENS[0]!];
  delete p[TENANT_THEME_TOKENS[1]!];
  expect(() => validatePalette(p, "light", true)).toThrow(
    new RegExp(`light is missing required token\\(s\\): ${TENANT_THEME_TOKENS[0]}, ${TENANT_THEME_TOKENS[1]}`),
  );
});

test("5: a partial DARK palette is accepted, because dark is an override map", () => {
  // The asymmetry that makes `complete` a parameter rather than always true. A
  // tenant sets only the dark tokens it wants to differ.
  const partial = { [TENANT_THEME_TOKENS[0]!]: "#111111" };
  expect(validatePalette(partial, "dark", false)).toEqual(partial);
  // And an empty override map is a legitimate "no dark overrides".
  expect(validatePalette({}, "dark", false)).toEqual({});
});

test("6: the envelope must carry at least one of light and dark", () => {
  expect(() => coerceImportedTheme({ light: undefined, dark: undefined })).toThrow(
    /Expected "light" and\/or "dark" token maps\./,
  );
  expect(() => coerceImportedTheme(null)).toThrow(/Expected a JSON object\./);
  expect(() => coerceImportedTheme("{}")).toThrow(/Expected a JSON object\./);
});

// ---- coerceImportedTheme: the two accepted input shapes -------------------------

test("a { light, dark } envelope is taken as given", () => {
  const light = complete();
  const dark = { [TENANT_THEME_TOKENS[0]!]: "#222222" };
  expect(coerceImportedTheme({ light, dark })).toEqual({ light, dark });
});

test("a bare token map is read as a complete light palette", () => {
  // The input convenience for a paste: a handoff that arrives as just the 14
  // tokens, with no envelope around them.
  const light = complete();
  expect(coerceImportedTheme(light)).toEqual({ light });
  // And it is held to the complete rule, being light.
  const short = complete();
  delete short[TENANT_THEME_TOKENS[0]!];
  expect(() => coerceImportedTheme(short)).toThrow(/missing required token/);
});

test("an envelope with only dark leaves light alone", () => {
  const dark = { [TENANT_THEME_TOKENS[0]!]: "#333333" };
  expect(coerceImportedTheme({ dark })).toEqual({ dark });
});

test("the client validator still mirrors the server's rule, token for token", () => {
  // Ticket 23's precedent: a hand-mirror is held to its canonical source by one
  // assertion rather than a refactor. Both this and the server's
  // `assertThemeTokens` read `TENANT_THEME_TOKENS`, so what is asserted is that
  // a palette the client accepts is exactly a palette with that token set.
  expect(Object.keys(validatePalette(complete(), "light", true)).sort()).toEqual([...TENANT_THEME_TOKENS].sort());
});

// ---- timeAgo -------------------------------------------------------------------

test("timeAgo buckets coarsely and never reads the clock behind the test's back", () => {
  const now = 1_000_000_000_000;
  expect(timeAgo(now, now)).toBe("0s ago");
  expect(timeAgo(now - 45_000, now)).toBe("45s ago");
  expect(timeAgo(now - 90_000, now)).toBe("2m ago");
  expect(timeAgo(now - 3_600_000, now)).toBe("1h ago");
  expect(timeAgo(now - 90_000_000, now)).toBe("1d ago");
});

test("timeAgo clamps a future timestamp to now rather than saying -5s ago", () => {
  const now = 1_000_000_000_000;
  expect(timeAgo(now + 60_000, now)).toBe("0s ago");
});

// ---- the destructive button's gate ----------------------------------------------

test("an empty tenant has no blockers, which is what enables Remove", () => {
  expect(tenantRemovalBlockers({ courses: 0, members: 0, users: 0 })).toEqual([]);
});

test("each kind of assignment blocks, and singular reads as singular", () => {
  expect(tenantRemovalBlockers({ courses: 1, members: 0, users: 0 })).toEqual(["1 course"]);
  expect(tenantRemovalBlockers({ courses: 2, members: 0, users: 0 })).toEqual(["2 courses"]);
  expect(tenantRemovalBlockers({ courses: 0, members: 1, users: 0 })).toEqual(["1 member"]);
  expect(tenantRemovalBlockers({ courses: 0, members: 0, users: 1 })).toEqual(["1 user account"]);
  expect(tenantRemovalBlockers({ courses: 0, members: 0, users: 3 })).toEqual(["3 user accounts"]);
});

test("every assignment is listed, so the operator clears all of them", () => {
  // The failure that matters: a gate reporting one blocker while two exist reads
  // as "clear this and you are done" over a tenant with 40 users.
  expect(tenantRemovalBlockers({ courses: 4, members: 12, users: 40 })).toEqual([
    "4 courses",
    "12 members",
    "40 user accounts",
  ]);
});
