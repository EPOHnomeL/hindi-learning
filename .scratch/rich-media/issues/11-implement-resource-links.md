# rich-media/11: Implement Resource links (AI cites owned Resources)

**Status:** ready-for-agent
**Scopes from:** [10 — AI linking into course Resources](10-scope-resource-deep-linking.md)
**Domain:** [[Resource link]] (CONTEXT.md)

## Goal

Let the teach skill write in-lesson [[Resource link]]s — `<a href="/courses/<slug>/resources/<id>">` —
that the reader resolves to a fresh signed URL and opens with sidebar parity. Whole-resource
only; no page/timestamp anchors.

## Acceptance criteria

- A published Lesson containing `<a href="/courses/<slug>/resources/<id>">…</a>`, clicked in the
  **authed reader**, opens that Resource exactly as the sidebar does — new tab for a PDF/URL,
  Markdown dialog for a `.md`.
- The same link works for a **[[Guest]]** on a free public Topic (`/share/<token>/…` context).
- A link whose `id` is **not in the reader's bundle** (paid [[Preview]] withhold, or deleted
  Resource) is a **graceful no-op**: no navigation, no thrown error, no console crash.
- `resources/_index.json` in a materialised workspace carries `id` and `readerPath` per entry;
  the `readerPath` is `/courses/<slug>/resources/<id>` and is copy-paste-correct.
- Translated Editions keep the link working (href untouched; same `id` resolves) — no new work
  expected here, just a regression guard.
- The teach skill authors a Resource link (reusing `.cite`) in preference to an external URL
  when a claim is grounded in an owned Resource.

## Implementation steps (test-first — `tdd`)

1. **Materialise payload** — expose the Resource `id` from
   [`materialiseTopic`](../../../convex/routine.ts) (it already returns filename/kind/status/
   contentHash/processed/rawUrl). *Test:* the query returns `id` per Resource.
2. **`_index.json` shape** — [`materialise.ts`](../../../scripts/materialise.ts#L71) writes
   `id` and precomputed `readerPath` (`/courses/${slug}/resources/${r.id}`) per entry. *Test:*
   a materialised entry has both fields with the expected path.
3. **Reader interceptor** — extend the [`internalNavTarget`](../../../src/app/_components/readerDerive.ts#L68)
   seam (and its click handler in the lesson-body renderer) to recognise a
   `/courses/<slug>/resources/<id>` target. Instead of navigating, **look up `id` in the
   in-bundle Resource list and open it** with the same logic
   [`ResourceItem`](../../../src/app/_components/ResourceItem.tsx#L59) uses (new tab vs Markdown
   dialog). Missing id → no-op. Cover both authed (`/courses/…`) and Guest (`/share/<token>/…`)
   contexts. *Tests:* pure-derivation tests for the target-recognition + missing-id no-op; the
   open behaviour follows the existing ResourceItem branch.
4. **Skill guidance** — update `.claude/skills/teach/AUTHORING.md` (§5 add the resource reader
   route next to lessons/references; §6 steer grounding citations to the owned Resource via
   `readerPath`) and `SKILL.md` §Knowledge (cite the owned Resource when the claim came from
   one). Mirror into `.agents/skills/teach/` (the two trees are kept in sync).
5. **Regression** — a translate test (or assertion) that a Resource-link href survives the
   `html`-mode pass unchanged.

## Out of scope

- `#page=` / `#t=` fragment anchors (deferred; video rides ticket 04).
- Any change to `convex/public.ts`, `convex/resources.ts`, or the translate logic itself.
- A dedicated in-reader resource page.

## Notes

- Link by **`id`**, never filename — filenames aren't guaranteed unique/stable; the bundle is
  keyed on `id`.
- Resource `id`s are already public (the Guest bundle exposes `id: v.id("resources")`), so
  baking them into immutable Lesson HTML exposes nothing new.
