# 04 — Resources: schema, file storage, dashboard upload

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Resource). Spec: [`../PRD.md`](../PRD.md).
Decision: [ADR 0009](../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md).

## Want

Let a learner upload a Resource (PDF, etc.) to a Topic; store the raw blob in
Convex file storage and index it.

## Acceptance

- `resources` table: `topicId`, `ownerId`, `filename`, `rawStorageId`,
  `processed` (optional manifest, filled by **06**), `contentHash`, `status`
  (`raw | processing | ready`), `kind`. Index `by_topic`.
- Upload flow: a Convex `generateUploadUrl` mutation + a client uploader in the
  dashboard; on completion, insert/update the `resources` row (dedupe by
  `contentHash`, mirroring how References dedupe).
- A learner can upload to a new Topic (at Seed time, see **07**) and to an
  existing Topic at any time; they see their Topic's Resource list.
- 35 MB PDFs upload fine (file storage, not a document field).

## Depends on

- **02** (Topic scoping / `ownerId`).

## Notes

- Only **raw** storage here. Lazy rendering/extraction into `processed` is **06**.
- Resource `kind` distinguishes uploaded docs from URL-style resources (the
  current `RESOURCES.md` carries both knowledge docs and links).
