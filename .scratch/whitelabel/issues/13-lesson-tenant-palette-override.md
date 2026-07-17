# whitelabel/13: Lesson/reference tenant palette override

**Status:** implemented (2026-07-17) — visual browser check pending (needs a tenant host + a course)
**Depends on:** [09](09-design-token-contract-cleanup.md), [11](11-ssr-theme-application.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[01 — Resolution](01-scope-design-system-integration.md) decision 1;
[03 — Resolution](03-scope-per-tenant-theming.md) decision 6.

## Why

Lesson HTML is wrapped at publish time and stored as an immutable blob — without this, a
tenant's palette wouldn't reach the one place learners spend most of their time (lessons,
references, translated Editions).

## Scope

- `buildSrcDoc` ([`src/app/_components/lessonSrcDoc.ts`](../../../src/app/_components/lessonSrcDoc.ts))
  gains a `tenantPalette?` param → injects one more `<style>` block (`:root` **bare** var names —
  `--accent`, `--paper`, etc., not the `--color-` prefix app chrome uses — light + dark) on the
  exact rail as the existing dark-mode/Devanagari injection.
- The reader passes the tenant's palette from the client tenant context (11).
- Covers lessons, references, **and** translated Editions — they all assemble through the same
  `buildSrcDoc`, so one wiring point covers all three (03 confirmed this holds for translations).
- **Partial fidelity on legacy content is accepted**: `head.html` hardcodes dozens of hex values
  beyond the 14 vars, so this override moves only the 14 vars — it does not repaint everything.
  Full fidelity for old courses is [23](23-legacy-course-tenant-backfill.md)'s job (generate/
  re-bake), not this issue's.

## Acceptance criteria

- Opening a lesson under a tenant subdomain shows the tenant's palette applied to the 14
  token-driven surfaces (verify visually against the mock fixtures); it does not need to
  perfectly match the tenant's palette everywhere `head.html` hardcodes a hex.
- A translated Edition and a reference page both pick up the same override (they share
  `buildSrcDoc`).
- Opening the same lesson on the default site is unchanged.

---

## Resolution (2026-07-17, opus — `/tdd` + `/ponytail`)

Lazy reuse of the issue-11 machinery — no new palette logic.

### What shipped

- **`src/design/tokens.ts` `buildTenantThemeCss(theme, prefix = "color-")`** — added a
  `prefix` param. App chrome (issue 11) keeps the default `--color-<t>`; lessons pass `""`
  for the design system's bare `--<t>` names (head.html). One builder, one 14-token contract,
  same `:root:root` specificity strategy (beats the authored `:root{}` regardless of source
  order) and same partial-dark cascade. Bare-prefix case pinned in `tokens.test.ts`.
- **`src/app/_components/lessonSrcDoc.ts`** — `buildSrcDoc` gains `tenantPalette?: TenantTheme`.
  When present, `injectTenantPaletteCss` splices one `<style>` (bare-var light + partial dark)
  **before `</head>`**, on the exact rail as the dark/Devanagari injections, injected **last** so
  it sits closest to `</head>` (wins source-order ties on top of its specificity). Covers lessons,
  references, and translated Editions — all assemble through `buildSrcDoc`. Absent → no override
  (default site unchanged). Tests in `lessonSrcDoc.test.ts` (present / absent).
- **`src/app/_components/ArtifactView.tsx` `Frame`** — reads `useTenant()?.theme` and passes it
  as `tenantPalette` (added to the srcDoc `useMemo` deps). `Frame` backs both `LessonView` and
  `ReferenceView`, so one wiring point covers all three artifact kinds. The editor (`buildEditDoc`)
  is deliberately left alone — out of scope (reader only).

### Design notes

- **Flash-tolerant by design (decision 03 #6):** the palette is baked into srcDoc (no live-flip
  bridge like light/dark). The iframe only builds once `html` has loaded — a client query that
  resolves alongside `useTenant()` — so in practice the palette is present at first build; a
  late arrival costs one rebuild, and a tenant's palette never changes mid-session.
- **Partial fidelity accepted:** only the 14 contract vars move; `head.html` hardcodes dozens of
  hex beyond them. Full fidelity for legacy courses is [23](23-legacy-course-tenant-backfill.md).

### Verification

- **Unit:** typecheck clean; `tokens` + `lessonSrcDoc` suites green (the new prefix + inject cases).
- **⚠ Visual browser check pending:** needs a tenant host **with a published course** to open a
  lesson/reference and eyeball the 14 token-driven surfaces against the mock fixtures (and confirm
  the default site is unchanged). Depends on issue 11's `getTheme` being deployed (now done) and a
  course existing under a tenant. Verify alongside 11's tenant-skin check.
