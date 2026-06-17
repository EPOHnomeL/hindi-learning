# 06 — Resource ingestion: lazy render + cache back

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Resource). Spec: [`../PRD.md`](../PRD.md).
Decision: [ADR 0009](../../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md).

## Want

Turn a raw Resource into agent-usable context the first time it's needed, and
cache the result so later runs reuse it (hybrid ingestion).

## Acceptance

- During `materialise` (issue **05**), for each Resource the agent needs: if no
  cached `processed` exists for the current `contentHash`, render/extract it in
  the agent's own env (PDF → page PNGs via the existing pymupdf path,
  [render_pages.py](../../../scripts/render_pages.py)) and **cache it back** to
  Convex file storage via a `PUBLISH_SECRET`-guarded mutation that fills
  `resources.processed` + sets `status: ready`.
- A changed `contentHash` (re-upload) invalidates the cache and re-renders.
- No separate ingestion worker — the agent's compute does it (works for the
  Routine now and the Phase-2 worker later).

## Depends on

- **04** (raw Resources exist), **05** (materialise path + claim).

## Notes

- Keeps scanned-page image fidelity (reading the actual handbook page), which is
  why raw is retained rather than text-only extraction.
- Concurrency: the cache write is idempotent by `contentHash`; two runs rendering
  the same Resource converge.
