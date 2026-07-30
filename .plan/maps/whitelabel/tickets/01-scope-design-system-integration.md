---
type: grilling
blocked_by: []
---
# Scope Claude design system integration (tokens + components)

## Question

The UI-redesign prototype (hosted Claude Artifact, 2026-07-06) was wired into React piecemeal
(`icons.tsx`, `ui.tsx`, `CourseSettings.tsx`, `Editions.tsx`, ad-hoc tokens in `globals.css`).
"Properly integrating" means promoting that pile into a **tokenised design system** — the
load-bearing prerequisite for whitelabel, since a tenant theme (ticket 03) should be nothing
more than a token override. Answer:

- Token inventory: what's hardcoded across `globals.css` and component styles (colors,
  typography, spacing, radii, shadows)? Define the canonical token set and naming.
- Component coverage: which surfaces still bypass the system (Landing, Certificate print view,
  reader chrome, dashboard remnants)? Which are in the integration pass?
- **The lesson-blob problem**: lesson HTML is wrapped at publish and stored immutable. If the
  design system (or a tenant theme) changes, published lessons don't. Inject the stylesheet at
  render time, version the wrapped head, or accept drift? This decision shapes ticket 03.
- Dark mode / print: token dimensions from day one, or out?
- Where the system lives: stay `src/app/_components/` + `globals.css`, or a dedicated
  `src/design/` module with a documented contract?
- Sync story between the prototype artifact and code after this pass — or does code become canonical?

Out of scope: any per-tenant theming (03); redesigning flows (visuals agreed in the prototype).

## Done when

A deliverable is produced: the canonical token set + component have/gap inventory, the
lesson-blob styling decision, and an ordered integration plan for the implementation tickets.

## Answer

Resolved 2026-07-15 (opus grilling), 7 decisions. The audit reframed the ticket: app chrome is
**already** token-driven, so "integration" is small — the payoff is pinning the token **contract**
that ticket 03's per-tenant theming rides.

**Findings that reframed it:** app chrome already integrated (500+ Tailwind token-class uses;
only `ArtifactView`/`Certificate` carry `dark:` overrides, both the same red-error case — the
"Landing/Dashboard/reader bypass" premise was stale); render-time injection is an established
pattern (`buildSrcDoc` in `lessonSrcDoc.ts` already mutates the immutable blob at render — bakes
`data-theme`, injects reference dark CSS + Devanagari CSS); the token surface is small
(`head.html` exposes ~13 vars but hardcodes dozens of other hexes — the override only moves the vars).

**Decisions:**
1. **Lesson-blob styling → render-time injection** in `buildSrcDoc`, same path as dark/Devanagari.
   Re-skins all published lessons instantly, no republish. Layered with (a) new courses *generated*
   in-style (baked at publish, full fidelity) and (b) migration scripts for existing courses —
   blocked on 02's course↔subdomain schema.
2. **One override re-skins both surfaces via shared variable names + a runtime map** (no codegen):
   shared semantic name, per-surface physical prefix (app chrome `--color-accent`; lesson iframe
   bare `--accent`).
3. **Curated semantic palette (~14 tokens):** `paper card ink soft line accent accent2 gold hi
   danger good good-b bad bad-b`. Hardcoded structural hex stays fixed.
4. **Dark: light required, dark optional** (absent dark falls back to shared default dark). Dark
   stays on everywhere. **Print out** as a tenant dimension (certificate keeps default styling).
5. **Home = a minimal `src/design/tokens.ts`** (token-name list + `TenantTheme` type). No component
   reorg (`ui.tsx`/`icons.tsx`/`ThemeContext.tsx` stay put).
6. **Single-brand integration pass:** add `tokens.ts`; reconcile `globals.css` + `head.html` to the
   contract; replace 7 raw-red errors with the `danger` token (`AdminPanel.tsx:119,143`,
   `ArtifactView.tsx:486`, `Certificate.tsx:684`, `SignIn.tsx:45`).
7. **Code is canonical.** `tokens.ts` + `globals.css` + `head.html` are source of truth; the
   2026-07-06 prototype artifact is archived (linked from the ADR), not synced forward.

**Theme shape handed to 03:**
```ts
type Token = 'paper'|'card'|'ink'|'soft'|'line'|'accent'|'accent2'|'gold'|'hi'|'danger'
           |'good'|'good-b'|'bad'|'bad-b';
type TenantTheme = { light: Record<Token,string>; dark?: Partial<Record<Token,string>>; };
```
The tenant *application* machinery (the `buildSrcDoc` param + app-chrome hook) belongs to 03; 01
only pins the contract and does the single-brand cleanup.
