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
