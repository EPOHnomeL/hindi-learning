---
type: task
blocked_by: []
---

# Fill af/es/fr/hi values + parity green

## Question

For every new key added in issues 01–06, add translated values to
`messages/{af,es,fr,hi}.json` (machine-generated; human review later). English is
authoritative.

Preserve ICU plural syntax and `<tag>` rich placeholders per language.

Done when: `pnpm test messages/parity.test.ts` (and the full `pnpm test`) is green;
no missing/extra keys in any locale.

## Done when

`pnpm test messages/parity.test.ts` and the full `pnpm test` are green, with no missing or extra keys in any locale.

<!-- Migrated 2026-07-30 from GitHub issue #72 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

## Answer

**Already built when this ticket was migrated — resolved 2026-08-18 by running the gate.**

The parity gate landed in `b2a4887` (2026-07-20, *feat(i18n): non-English catalogues,
parity gate & Devanagari chrome font*), ten days before this ticket was migrated in,
and `messages/{af,es,fr,hi}.json` have been carried key-complete against `en.json`
ever since — including through the keys added after this ticket was filed (e.g.
`fix(dashboard): add missing Dashboard.free translation key`, 2026-08-02, which is the
gate doing its job).

Run 2026-08-18 on `main` @ `bf04257`:

```
pnpm vitest run messages/parity.test.ts
Test Files  1 passed (1)
     Tests  5 passed (5)
```

No missing and no extra keys in any locale. ICU plurals and `<tag>` rich placeholders
are covered by the same test file, which is the one specced on the sibling
[app-language-i18n](../../app-language-i18n/map.md) map.
