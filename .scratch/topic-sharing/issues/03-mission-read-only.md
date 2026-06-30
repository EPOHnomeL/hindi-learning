# 03 — Mission, read-only for Viewers

Status: done (commits 0898055 carries the Mission on `listSharedTopics`, 9f9889d
shows it read-only on the shared card via the existing popup, fe9548c tests).
`editMission` / `renameTopic` / re-seed were already owner-only.

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md).

## Want

A Viewer reads a shared Topic's **Mission** but cannot change it (nor rename or
re-seed the Topic). The full Mission facet, top to bottom.

## Acceptance

- The Mission is visible to a Viewer wherever the owner sees it, via the
  owner-or-Viewer resolver (from **01**).
- A Viewer is refused server-side by `editMission`, `renameTopic`, and re-seed —
  these stay owner-only.
- The Mission edit control (and rename/re-seed) are absent for a Viewer.
- Tests (Convex seam): a Viewer can read the Mission; `editMission` / rename
  reject for a Viewer; the owner is unaffected.

## Depends on

- **01**.

## Notes

- Covers PRD story 20 and the rename/re-seed part of 23.
