---
type: task
blocked_by: [09, 11]
---
# Lesson/reference tenant palette override

## Question

Lesson HTML is wrapped at publish time and stored as an immutable blob — without this, a tenant's
palette wouldn't reach the one place learners spend most of their time (lessons, references,
translated Editions). Ground truth: 01 decision 1; 03 decision 6. Scope:

- `buildSrcDoc` (`src/app/_components/lessonSrcDoc.ts`) gains a `tenantPalette?` param → injects one
  more `<style>` block (`:root` **bare** var names — `--accent`, `--paper`, not `--color-` — light +
  dark) on the exact rail as the existing dark-mode/Devanagari injection.
- The reader passes the tenant's palette from the client tenant context (11).
- Covers lessons, references, **and** translated Editions (all assemble through `buildSrcDoc`).
- **Partial fidelity on legacy content accepted**: `head.html` hardcodes dozens of hex beyond the 14
  vars, so this moves only the 14. Full fidelity for old courses is 23's job.

## Done when

Opening a lesson under a tenant subdomain shows the tenant's palette on the 14 token-driven
surfaces (doesn't need to match everywhere `head.html` hardcodes a hex); a translated Edition and a
reference page both pick up the same override; opening the same lesson on the default site is
unchanged.

## Answer

Built test-first 2026-07-17 (opus, `/tdd` + `/ponytail`) — lazy reuse of the issue-11 machinery, no
new palette logic.

- **`src/design/tokens.ts` `buildTenantThemeCss(theme, prefix = "color-")`** — added a `prefix`
  param. App chrome (11) keeps `--color-<t>`; lessons pass `""` for the design system's bare `--<t>`
  names. One builder, one 14-token contract, same `:root:root` specificity + partial-dark cascade.
- **`src/app/_components/lessonSrcDoc.ts`** — `buildSrcDoc` gains `tenantPalette?: TenantTheme`. When
  present, `injectTenantPaletteCss` splices one `<style>` (bare-var light + partial dark) before
  `</head>`, injected **last** so it sits closest to `</head>` (wins source-order ties). Covers
  lessons, references, translated Editions. Absent → no override (default site unchanged). Tests in
  `lessonSrcDoc.test.ts`.
- **`src/app/_components/ArtifactView.tsx` `Frame`** — reads `useTenant()?.theme` and passes it as
  `tenantPalette` (added to the srcDoc `useMemo` deps). `Frame` backs both `LessonView` and
  `ReferenceView`, so one wiring point covers all three artifact kinds. The editor (`buildEditDoc`)
  is left alone (reader only).

**Design notes:** flash-tolerant by design (03 #6) — the palette is baked into srcDoc (no live-flip
bridge); the iframe only builds once `html` loaded (a client query resolving alongside `useTenant()`),
so the palette is present at first build. Partial fidelity accepted; full fidelity is 23.

**Verification:** typecheck clean; `tokens` + `lessonSrcDoc` suites green. **⚠ Visual browser check
pending:** needs a tenant host **with a published course** to eyeball the 14 surfaces against the
mock fixtures (and confirm default unchanged). Depends on 11's `getTheme` being deployed and a
course existing under a tenant. Verify alongside 11's tenant-skin check.
