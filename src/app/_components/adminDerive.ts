import { TENANT_THEME_TOKENS } from "../../design/tokens";

// **The Admin panel's pure cores.** Beside `salesChart.ts` and `dayChart.ts`,
// which are the same idea already applied to the panel's charts.
//
// `AdminPanel.tsx` was 2660 lines with 52 top-level functions and exactly ONE
// export, the component. Everything in here was reachable only by rendering it,
// so none of it was tested: not the palette import with its six distinct throws,
// not the money formatting on ten call sites, and not the blockers that gate a
// destructive button (ticket 34, candidate 10 of the 2026-09-04 review).
//
// **The five-way tab split is explicitly NOT here.** That waits on ticket 03
// settling the component vocabulary. This is the half that carries untested risk
// and can move on its own.

export type Palette = Record<string, string>;

// ---- the pasted-palette import -------------------------------------------------

// Validate a pasted palette into a `{ light?, dark? }` update. Accepts either the
// `{ light, dark }` envelope a Claude or Figma handoff arrives in, or a bare
// 14-token map (treated as a complete light palette). Light, when present, must
// be complete and use only known tokens; dark may be a partial subset. Throws a
// human-readable message the UI surfaces.
//
// **It mirrors the server's `assertThemeTokens`, and the two were checked against
// each other on 2026-09-08 before this moved.** They have NOT drifted: same token
// set (both read `TENANT_THEME_TOKENS`), same unknown-token refusal, same
// light-complete rule, same deliberately-partial dark. Two differences, both
// intentional rather than drift:
//
//   - This also refuses a non-string colour. The server declares
//     `Record<string, string>` and gets that guarantee from its Convex validator
//     instead, so the rule is enforced at both layers, not missing from one.
//   - This accepts a bare token map with no envelope, which the server does not.
//     That is an input convenience for a paste, not a different rule about what a
//     valid theme is.
//
// The server remains the boundary. This exists so a bad paste fails before the
// round-trip, and `adminDerive.test.ts` pins the mirror to its canonical source
// with one assertion, which is the precedent ticket 23 set for the token list.
export function coerceImportedTheme(parsed: unknown): { light?: Palette; dark?: Palette } {
  if (!parsed || typeof parsed !== "object") throw new Error("Expected a JSON object.");
  const obj = parsed as Record<string, unknown>;
  const hasEnvelope = "light" in obj || "dark" in obj;
  const result: { light?: Palette; dark?: Palette } = {};
  const rawLight = hasEnvelope ? obj.light : obj;
  if (rawLight !== undefined) result.light = validatePalette(rawLight, "light", true);
  if (hasEnvelope && obj.dark !== undefined) result.dark = validatePalette(obj.dark, "dark", false);
  if (result.light === undefined && result.dark === undefined) {
    throw new Error('Expected "light" and/or "dark" token maps.');
  }
  return result;
}

export function validatePalette(raw: unknown, name: string, complete: boolean): Palette {
  if (!raw || typeof raw !== "object") throw new Error(`${name} must be an object of token to colour.`);
  const known = new Set<string>(TENANT_THEME_TOKENS);
  const entries = Object.entries(raw as Record<string, unknown>);
  const unknown = entries.map(([k]) => k).filter((k) => !known.has(k));
  if (unknown.length) throw new Error(`${name} has unknown token(s): ${unknown.join(", ")}`);
  const palette: Palette = {};
  for (const [k, val] of entries) {
    if (typeof val !== "string") throw new Error(`${name} token "${k}" must be a colour string.`);
    palette[k] = val;
  }
  if (complete) {
    const missing = TENANT_THEME_TOKENS.filter((tok) => !(tok in palette));
    if (missing.length) throw new Error(`${name} is missing required token(s): ${missing.join(", ")}`);
  }
  return palette;
}

// ---- the monitoring glance ------------------------------------------------------

// A short "time ago" for a past timestamp (ms). Coarse buckets, because this is a
// monitoring glance rather than a precise clock.
//
// `now` is a parameter with a default rather than a `Date.now()` call inside,
// which is the only change made on the way out: a function that reads the clock
// itself cannot be tested without faking global time.
export function timeAgo(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ---- the destructive button's gate ----------------------------------------------

// What is still assigned to a tenant, in the operator's words, and therefore
// whether it may be removed.
//
// This was computed inline in render, and it **gates a destructive button**: an
// empty list enables Remove. `tenantReferenceCounts` and `removeTenant` re-check
// server-side, so this is the affordance rather than the rule, but an affordance
// that says "nothing assigned" over a tenant with 40 users is how an operator
// comes to press it.
export type TenantCounts = { courses: number; members: number; users: number };

export function tenantRemovalBlockers(counts: TenantCounts): string[] {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const blockers: string[] = [];
  if (counts.courses > 0) blockers.push(plural(counts.courses, "course", "courses"));
  if (counts.members > 0) blockers.push(plural(counts.members, "member", "members"));
  if (counts.users > 0) blockers.push(plural(counts.users, "user account", "user accounts"));
  return blockers;
}
