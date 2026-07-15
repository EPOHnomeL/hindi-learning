# whitelabel/03: Scope per-tenant branding & theming

**Status:** done
**Claimed:** session 2026-07-15 (theming grilling)
**Depends on:** 01, 02
**Labels:** wayfinder:grilling

Child of [Whitelabel map](00-whitelabel-map.md). User-pinned at charting (2026-07-15): styling
is the **top priority** of the whole whitelabel effort, and tenant themes will be authored as
**Claude design systems** handed to each tenant — so the theme shape must be something a
Claude-generated design system can compile down to (a token override set, per ticket 01).

## Why

Each tenant site (upf, ywampotch, almighty-warrior, yknot) needs its own look: logo, palette,
typography, landing copy — "different styles" per brand. Ticket 01 turns the design system
into tokens; ticket 02 gives us a tenant record; this ticket scopes how a tenant's theme is
authored, stored, and applied.

## Questions to answer

- Theme shape: a token-override object on the tenant record (colors, fonts, radius, logo
  asset id) — how much is themeable in v1? (Recommendation to test: palette + logo + name +
  landing copy only; typography later.)
- Application mechanism: server-render CSS variables from the resolved tenant in the root
  layout (no flash, no client fetch)? Fonts — self-hosted per tenant or one shared stack?
- Brand assets: logos/og-images as Convex storage blobs on the tenant record (Emblem-style
  mint-new-never-overwrite), favicon per tenant?
- Surface inventory: dashboard/reader chrome (tokens from 01), Landing page (per-tenant copy —
  content, not just style?), invite emails, Certificates (tenant-branded certs matter for
  these orgs), the print stylesheet.
- Published lesson blobs: apply the 01 decision — themed at render time so one course looks
  native on its tenant without republishing. Confirm it holds for translations
  (inline-html rows) too.
- Who edits a theme — answered at charting: the platform operator, via the whitelabel
  dashboard ([ticket 06](06-scope-operator-whitelabel-dashboard.md)). This ticket only decides
  the theme *record* the dashboard will edit; tenant self-service stays out of the map's scope.

## Out of scope

- The token system itself (01) and tenant resolution (02).
- Tenant self-service theming UI (note as deferred unless scoping says otherwise).

## Deliverable

Theme record shape, the application mechanism (SSR CSS vars), the v1 themeable-surface list,
and mock theme values for the four named tenants as the acceptance fixture.

---

## Resolution (2026-07-15, opus grilling session)

Grilled to shared understanding across 8 decisions. Ticket 01 had already pinned the *colour*
contract (the 14-token `TenantTheme`, light required + dark optional) and the `buildSrcDoc`
injection rail — so 03 owned the rest of the theme *record*, where it lives, how assets are
handled, the no-flash application mechanism, and the per-surface disposition.

### Findings that framed the questions (codebase reality, verified this session)

- **`tenants` table doesn't exist yet** — theme record designed clean (ADR 0021 left it a
  placeholder).
- **Root layout is a Server Component** ([`src/app/layout.tsx`](../../../src/app/layout.tsx)) that
  can read `headers()` + fetch server-side; it already runs a pre-paint inline `<script>` stamping
  `data-theme` from `localStorage` before paint (the dark/light no-flash rail — ADR 0011). The
  per-tenant palette rides the same "before paint" idea.
- **The app has no server-side Convex fetch today** — everything is client `useQuery`. The SSR
  palette introduces the first `fetchQuery` (from `convex/nextjs`).
- **`src/middleware.ts` exists** (handoff said it didn't) but is only the Convex Auth wrapper —
  tenant resolution would extend that handler.
- **`convex/emblem.ts`** is a ready template for brand-asset storage: store `Id<"_storage">`,
  upload via `resources.generateUploadUrl`, validate type/size in the mutation, `getUrl` at read,
  **never overwrite** (immutable/mint-new); **SVG refused** (XSS on anonymous pages).
- **Every artifact — lessons, references, translated Editions — assembles through one
  `buildSrcDoc`** ([`lessonSrcDoc.ts`](../../../src/app/_components/lessonSrcDoc.ts)); the lesson
  iframe uses **bare** var names (`--accent`, `--paper`…), app chrome uses the `--color-` prefix
  (per 01 #2).
- **`inviteEmail.ts`** is a pure renderer already parameterised by a flat inline-hex palette object
  `C` + a hardcoded `BRAND` — so tenant theming is a cheap substitution, no email-CSS gymnastics.
- **`Certificate.tsx`** hardcodes `"My Course"` (×2), uses palette tokens, and has an `@media print`
  A4 stylesheet (`globals.css .cert-doc*`); its link is canonical to the course's host, so it
  already renders under the owning tenant's skin.

### Decisions

1. **Storage & shape — inline nested object on the `tenants` row; edit-is-live.** No separate
   `themes` table (a theme has exactly one owner and no independent lifecycle — a table buys only a
   join on the hot host→theme path) and no draft/published states in v1 (widen-later if needed).
   One indexed `by_slug` read resolves slug + displayName + theme + flags together.
2. **Typography — shared font stack; no per-tenant fonts in v1** (deferred to fog). Per-tenant fonts
   is the highest-cost/lowest-payoff dimension (`next/font` is build-time static; runtime fonts mean
   FOUT/self-hosting/licensing and threaten the no-flash goal), Devanagari support is load-bearing,
   and palette + logo already carry the brand. No `fontStack` field; add one later if a tenant
   demands a typeface.
3. **Assets — logo + favicon** (og-image deferred). Both optional `Id<"_storage">`, **raster-only**
   (PNG/JPEG/WebP; SVG refused — the landing is anonymous, same XSS threat as emblem), **single**
   (no light/dark pair for v1). Reuse the emblem upload/validate/`getUrl`/mint-new rail verbatim.
   Logo falls back to the `displayName` text wordmark; favicon falls back to the shared `/icon.svg`.
4. **Landing — bespoke per-tenant pages, hand-authored in code** (operator will build them, one
   Claude design system per tenant). **No landing content in the DB, nothing runtime-editable.**
   Selection = a slug→component registry (`src/app/_landing/registry.ts`), chosen in `page.tsx`'s
   `<Unauthenticated>` branch, **falling back to the default `<Landing/>`** (which a tenant's palette
   still re-skins). Custom pages render under the resolved host so they inherit the SSR palette and
   can add bespoke styling on top. Bare `my-course.app` keeps today's `<Landing/>`. **Knock-on:**
   ticket 06's dashboard does **not** edit landing — new/changed pages ship via commit + deploy.
5. **Application — SSR server-fetch, no flash (option A).** Root layout reads the `Host` header →
   derives the slug (leftmost label vs known set, else default) → `await fetchQuery(tenants.getTheme,
   {slug})` → injects `<style id="tenant-theme">` defining the 14 vars for `:root` (light) and
   `:root[data-theme="dark"]` (tenant dark, else default dark), **before body paint**. Composes with
   the existing dark-mode script (which only toggles the attribute; the injected `<style>` supplies
   both states' values). Favicon set via `generateMetadata` (also server, reads host). **Logo** is
   in-body/flash-tolerant → delivered via a client tenant context (a single `useQuery` for the
   resolved tenant), not the no-flash `<style>`. Palettes stay **runtime-editable** (this is why A,
   not the code-baked option C). The per-request read is a tiny indexed lookup; add Next caching
   keyed by slug later if SSR latency shows up (ponytail: not now).
6. **Lessons — render-time `buildSrcDoc` palette override** (= 01 decision #1, confirmed in 03's
   context). `buildSrcDoc` gains a `tenantPalette?` param → injects one more `<style>` (`:root`
   bare-var light + `:root[data-theme="dark"]` dark) on the exact rail as the existing
   dark/Devanagari injection. The reader passes it from the client tenant context (Q5). **Covers
   lessons + references + translated Editions** — they share `buildSrcDoc` (the "does it hold for
   translations" question: yes). **Partial fidelity on legacy accepted:** `head.html` hardcodes
   dozens of hex beyond the ~14 vars, so an override moves the vars only; full fidelity comes from
   generating new courses in-style (baked at publish). **Downstream impl deliverable (not this
   scope):** a backfill/migration script to assign old courses a `tenantSlug` and re-bake their
   style — now unblocked schema-wise by ADR 0021, pairs with the generate-in-style path.
7. **Email — full palette-derived, logo'd, light-only.** Thread the resolved tenant into
   `renderInviteEmail`: `BRAND` → `displayName`; the `C` object → **derived from the tenant's light
   tokens** (`page←paper`, `card←card`, `border←line`, `heading←ink`, `body/muted←soft`,
   `accent←accent`); add the logo as a header `<img>` (absolute storage URL) with text-wordmark
   fallback. Cheap because `C` is already a flat inline-hex object. Closes ADR 0021's
   "My-Course-branded-invite-to-a-ywampotch-learner" leak. Light-only (email dark mode is
   client-controlled and not worth chasing).
8. **Certificate — identity-only, styling frozen (option B).** Replace the two `"My Course"` strings
   with `displayName`, add the tenant logo — but **freeze the cert's palette to its default gold-foil
   look** via a `.cert-doc { --accent: …; … }` token reset, so the SSR override doesn't bleed in.
   On screen **and** print (honours 01 #4: print is not a tenant dimension; cert keeps default
   styling; screen == print). "Tenant-branded" for these orgs = their name + mark on the keepsake,
   not recolouring the foil.

### The theme record shape (handed to schema / ticket 06)

Inline on the `tenants` row (slug + displayName already there per ADR 0021 §1; `flags` from 04):

```ts
theme: v.object({
  // The 14-token TenantTheme from ticket 01. Stored as a validated record (not a
  // fixed v.object) so the CSS-friendly hyphenated token names — good-b, bad-b —
  // stay as keys; validated in code against the token list in src/design/tokens.ts.
  light: v.record(v.string(), v.string()),            // required — all 14 tokens
  dark:  v.optional(v.record(v.string(), v.string())),// optional — partial; else default dark
  logo:    v.optional(v.id("_storage")),               // raster, mint-new; else displayName wordmark
  favicon: v.optional(v.id("_storage")),               // raster; else /icon.svg
})
```

Tokens (from 01): `paper card ink soft line accent accent2 gold hi danger good good-b bad bad-b`.

### v1 themeable-surface list

| Surface | Mechanism | Themed by |
|---|---|---|
| App chrome (dashboard, course shell, reader chrome, sign-in) | SSR inline `<style>` `--color-*` override in root layout (Q5) | palette (light+dark) |
| Favicon | `generateMetadata` from tenant favicon (Q5) | favicon asset |
| Logo / brand name (headers, footers) | client tenant context (Q5) | logo asset + displayName |
| Landing page | bespoke per-tenant component via registry (Q4) | hand-authored; palette re-skins the default fallback |
| Lessons / references / translated Editions | `buildSrcDoc` `tenantPalette` injection (Q6) | palette (bare vars), partial fidelity on legacy |
| Invite / notification email | `renderInviteEmail` tenant params (Q7) | palette-derived (light) + logo |
| Certificate | identity swap + frozen `.cert-doc` palette (Q8) | displayName + logo only |
| **Print stylesheet** | — | **not themed** (out, per 01 #4 + Q8) |
| **Typography / fonts** | — | **not themed** (deferred, Q2) |

### Mock theme values — the four tenants (acceptance fixture)

**Placeholders.** The operator will author a real Claude design system per tenant to replace these;
they exist so the mechanism has fixtures to test against (the map's "four tenant theme fixtures"
fog). Anchored on the real default palette (warm cream/maroon/teal/gold). Light shown for all four;
`dark` given for one (yknot) to exercise the optional-dark shape — the other three omit `dark` and
fall back to the shared default dark palette per decision (01 #4).

```ts
// Default (my-course.app) — for reference, from globals.css
// light: paper #fbf7f0 card #fffdf9 ink #2b2622 soft #6b6258 line #e7ddd4
//        accent #9c5b34 accent2 #3f6f5e gold #b88a2e hi #fbeecb
//        danger #b4442f good #3f7d54 good-b #cfe6d6 bad #b4442f bad-b #f0d2ca

const MOCK: Record<string, TenantTheme> = {
  // upf — academic slate-blue
  upf: { light: {
    paper:"#f6f8fb", card:"#ffffff", ink:"#1e2833", soft:"#5b6b7b", line:"#dde5ee",
    accent:"#2f5d8a", accent2:"#4a8f8a", gold:"#c2953f", hi:"#e6eef7",
    danger:"#c0432f", good:"#3f7d54", "good-b":"#cfe6d6", bad:"#c0432f", "bad-b":"#f2d6cf",
  }},
  // ywampotch — warm missions orange / teal
  ywampotch: { light: {
    paper:"#fdf8f2", card:"#fffefb", ink:"#33261c", soft:"#7a6a58", line:"#ece0d2",
    accent:"#d2662a", accent2:"#2f8f7a", gold:"#cf9a3a", hi:"#fbe9d6",
    danger:"#c14631", good:"#3c8560", "good-b":"#cfe8db", bad:"#c14631", "bad-b":"#f4d8cf",
  }},
  // almighty-warriors — bold navy / gold (accent2 a crimson counter)
  "almighty-warriors": { light: {
    paper:"#f4f5f8", card:"#ffffff", ink:"#16203a", soft:"#55607a", line:"#d9deea",
    accent:"#1f2f5c", accent2:"#b03a3a", gold:"#c9a227", hi:"#e6e9f4",
    danger:"#b3382f", good:"#3a7d55", "good-b":"#cde5d5", bad:"#b3382f", "bad-b":"#f0d4cf",
  }},
  // yknot — modern indigo / violet (with a dark variant to exercise the shape)
  yknot: {
    light: {
      paper:"#f7f6fb", card:"#ffffff", ink:"#201c2e", soft:"#635d78", line:"#e2def0",
      accent:"#5b46c9", accent2:"#2f9c8f", gold:"#c99a3a", hi:"#ece8fb",
      danger:"#c23a52", good:"#3a7d63", "good-b":"#cde7dc", bad:"#c23a52", "bad-b":"#f2d3da",
    },
    dark: {
      paper:"#151320", card:"#1e1a2b", ink:"#e7e2f2", soft:"#a49bbd", line:"#332d47",
      accent:"#9a86f0", accent2:"#5fc7b6", gold:"#d8b45a", hi:"#2a2340",
    },
  },
};
```

### 03's implementation issues (for the eventual PRD breakdown)

1. Schema: add the `theme` object to the `tenants` table (record palette + optional dark + logo/
   favicon storage ids); seed the four mock themes.
2. SSR application: root-layout `Host`→slug→`fetchQuery`→inline `<style>` (light+dark) + favicon via
   `generateMetadata`; the first server-side Convex fetch wiring.
3. Client tenant context: one `useQuery` resolving the tenant (displayName, logo URL, flags); logo +
   brand-name consumers read from it.
4. Brand-asset upload: tenant logo/favicon via the emblem rail (raster validation, mint-new);
   surfaced in ticket 06's dashboard.
5. Lesson override: `buildSrcDoc` `tenantPalette` param + reader wiring (covers references +
   translated Editions).
6. Email: thread tenant (displayName + palette-derived `C` + logo) through `renderInviteEmail`.
7. Certificate: `displayName`/logo swap + `.cert-doc` palette freeze.
8. Landing registry: `src/app/_landing/registry.ts` + `page.tsx` selection + default fallback.
9. **Downstream (own issue, not v1 mechanism):** backfill/migration script — assign old courses a
   `tenantSlug` + re-bake style for full fidelity; pairs with generate-in-style.
