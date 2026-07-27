# 09 — Fill af/es/fr/hi values + parity green

For every new key added in issues 01–06, add translated values to
`messages/{af,es,fr,hi}.json` (machine-generated; human review later). English is
authoritative.

Preserve ICU plural syntax and `<tag>` rich placeholders per language.

Done when: `pnpm test messages/parity.test.ts` (and the full `pnpm test`) is green;
no missing/extra keys in any locale.
