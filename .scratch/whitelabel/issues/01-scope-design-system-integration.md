# whitelabel/01: Scope Claude design system integration (tokens + components)

**Status:** done
**Depends on:** —
**Labels:** wayfinder:grilling
**Claimed:** jonathan (opus session, 2026-07-15)

Child of [Whitelabel map](00-whitelabel-map.md).

## Why

The UI-redesign prototype (hosted Claude Artifact, 2026-07-06) was wired into React piecemeal:
`icons.tsx` (inline-SVG icon set), `ui.tsx` (IconButton/Dialog/Menu/ConfirmDialog),
`CourseSettings.tsx`, `Editions.tsx`, plus ad-hoc tokens in `globals.css` (e.g.
`--color-danger`). "Properly integrating" means promoting that from a pile of components into
a **tokenised design system** — which is also the load-bearing prerequisite for whitelabel:
a tenant theme (ticket 03) should be nothing more than a token override.

## Questions to answer

- Token inventory: what's currently hardcoded across `globals.css` and component styles
  (colors, typography, spacing, radii, shadows)? Define the canonical token set and naming.
- Component coverage: which surfaces still bypass the system (Landing, Certificate print view,
  reader chrome, dashboard remnants)? List the gaps; decide which are in the integration pass.
- **The lesson-blob problem**: lesson HTML is wrapped with a shared head/stylesheet at publish
  and stored as an immutable blob. If the design system (or later a tenant theme) changes,
  published lessons don't. Options: inject the stylesheet at render time in the reader instead
  of baking it in at publish; version the wrapped head; accept drift. This decision shapes
  ticket 03 — take a position here.
- Dark mode / print: are they token dimensions from day one or explicitly out?
- Where does the system live — stay as `src/app/_components/` + `globals.css`, or a dedicated
  `src/design/` module with a documented contract the teach-skill AUTHORING assets also
  reference?
- The prototype artifact remains the design source of truth until wiring is done — what's the
  sync story between artifact and code after this pass (or does the code become canonical)?

## Out of scope

- Any per-tenant theming (ticket 03) — this ticket makes theming *possible*, single-brand.
- Redesigning flows; visual decisions were already agreed in the prototype.

## Deliverable

Token set + component inventory (have/gap), the lesson-blob styling decision, and an ordered
integration plan for the implementation tickets.

---

## Resolution (2026-07-15, opus grilling session)

Grilled to shared understanding across 7 decisions. The audit reframed the ticket: the app chrome
is **already** token-driven, so "integration" is small — the real payoff is pinning the token
**contract** that ticket 03's per-tenant theming rides.

### Findings that reframed the questions

- **App chrome is already integrated.** 500+ Tailwind token-class uses across the components
  (`text-soft` ×125, `border-line` ×93, `text-accent` ×78, `text-ink` ×56, `bg-hi` ×55…). Only two
  files carry any `dark:` overrides (`ArtifactView`, `Certificate`), both for the same red-error
  case. The "Landing/Dashboard/reader chrome bypass the system" premise was stale.
- **Render-time injection is an established pattern, not a new idea.** `buildSrcDoc`
  (`src/app/_components/lessonSrcDoc.ts`) already mutates the immutable lesson blob at render:
  bakes `data-theme`, injects a dark palette for references (`injectReferenceDarkCss`), injects
  Devanagari CSS, strips the legacy theme pill. A tenant token override rides the same rail.
- **The token surface is small.** `head.html` exposes ~13 CSS vars but hardcodes dozens of other
  hex values; the override only moves the vars. That's acceptable because native fidelity comes
  from generating tenant courses in-style, not from overriding the default blob.

### Decisions

1. **Lesson-blob styling → render-time injection.** Inject a tenant `:root` token override in
   `buildSrcDoc`, same path as the existing dark/Devanagari injection. Re-skins all published
   lessons instantly, no republish, zero drift. **Layered with:** (a) new courses are *generated*
   in the tenant's style so the palette is baked natively at publish (full fidelity incl.
   non-variable parts); (b) **migration scripts** move existing courses under a tenant — an
   implementation deliverable **blocked on [02](02-scope-tenant-subdomain-model.md)**'s
   course↔subdomain schema, not buildable in this planning ticket.
2. **One tenant override re-skins both surfaces via shared variable names + a runtime map.** No
   codegen. The semantic name is shared; the physical prefix differs per surface (app chrome
   `--color-accent`, Tailwind `@theme`; lesson iframe bare `--accent`). The override applies each
   with the right prefix.
3. **Curated semantic palette** (~14 tokens): `paper card ink soft line accent accent2 gold hi
   danger good good-b bad bad-b`. Hardcoded structural hex stays fixed on the override path.
4. **Dark: light required, dark optional** → absent dark falls back to the shared default dark
   palette. Dark mode stays on everywhere; it's just not re-skinned unless a tenant supplies it.
   **Print out** as a tenant dimension (certificate keeps its default styling).
5. **Home: a minimal `src/design/tokens.ts`** — token-name list + `TenantTheme` type; runtime is
   typed against it, and the authoring/generation prompt cites it. No component reorg
   (`ui.tsx`/`icons.tsx`/`ThemeContext.tsx` stay put).
6. **Integration pass (single-brand) is minimal:** (i) add `tokens.ts`; (ii) reconcile
   `globals.css` + `head.html` to the contract (align `--color-danger` vs `--bad`/`--bad-b`
   naming; ensure both define the full set); (iii) replace 7 raw-red errors with the `danger`
   token (`AdminPanel.tsx:119,143`, `ArtifactView.tsx:486`, `Certificate.tsx:684`,
   `SignIn.tsx:45`). Certificate bespoke CSS and lesson-blob hex left as intentional/fixed.
7. **Code is canonical.** `tokens.ts` + `globals.css` + `head.html` are the source of truth; the
   2026-07-06 prototype artifact is archived as a historical reference (link it from the ADR),
   not synced forward.

### The theme shape handed to ticket 03

```ts
type Token = 'paper'|'card'|'ink'|'soft'|'line'|'accent'|'accent2'|'gold'|'hi'|'danger'
           |'good'|'good-b'|'bad'|'bad-b';
type TenantTheme = {
  light: Record<Token, string>;        // required
  dark?: Partial<Record<Token, string>>; // optional; else default dark
};
```
Applied: lessons via an injected `:root` `<style>` in `buildSrcDoc`; app chrome via an inline
CSS-var override. **The tenant *application* machinery (the `buildSrcDoc` param + app-chrome hook)
belongs to ticket 03, not here** — 01 only pins the contract and does the single-brand cleanup.

### 01's own implementation issues (for the eventual PRD breakdown)

1. Add `src/design/tokens.ts` (names + `TenantTheme` type + per-surface prefix rule documented).
2. Reconcile `globals.css` + `head.html` palettes to the contract.
3. Replace the 7 raw-red errors with the `danger` token.
