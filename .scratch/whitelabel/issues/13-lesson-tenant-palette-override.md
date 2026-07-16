# whitelabel/13: Lesson/reference tenant palette override

**Status:** open
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
