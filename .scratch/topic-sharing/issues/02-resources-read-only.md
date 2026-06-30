# 02 — Resources, read-only for Viewers

Status: done (commits 0898055 widens `listResources` to owner-or-Viewer, 9f9889d
hides the upload/link controls for Viewers, fe9548c tests). `addResource` /
`addUrlResource` were already owner-only; there is no delete-Resource mutation,
so nothing to block there.

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md).

## Want

A Viewer sees a shared Topic's **Resources** and can open them, but cannot add
or remove any. The full Resources facet, top to bottom: read for Viewers,
write blocked for Viewers, UI controls hidden, tests at the seam.

## Acceptance

- The Resources read query resolves through the owner-or-Viewer resolver (from
  **01**), so a Viewer sees the list and gets working open/signed links.
- A Viewer is refused server-side by `addResource`, `addUrlResource`,
  `generateUploadUrl`, and Resource deletion — these stay owner-only.
- In the read-only Reader, the upload / link / delete controls are absent for a
  Viewer; the list itself stays visible.
- Tests (Convex seam, `convex/*.test.ts` style): a Viewer can read Resources;
  a Viewer's add/delete mutations reject; the owner is unaffected.

## Depends on

- **01** (needs the `shares` relation, the read-resolver, and a Viewer who can
  open the Reader).

## Notes

- Covers PRD stories 15, 19, and the delete-Resource part of 23.
