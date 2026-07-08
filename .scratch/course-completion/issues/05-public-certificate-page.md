# 05 — The public Certificate page (anonymous view + PDF download)

Status: done — shipped 90429df (page redesign b48632b/3acb183)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Certificate**, **Certificate link**, **Guest**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0015](../../../docs/adr/0015-course-completion-and-certificates.md).

## Want

The shareable artefact: an anonymous `/certificate/[token]` page that renders a
clean, printable Certificate from the token-only query, downloadable as PDF via
the browser — and reused as the in-app "View certificate" view.

## Acceptance

- **A public route `/certificate/[token]`** outside the `(app)` auth group
  (alongside `/share/[token]`, ADR 0012), rendering from `publicCertificate`
  (`02`). Anyone with the link opens it with no account.
- **Content**: the learner's snapshot name, the course title, "has completed",
  the completion date, and the lesson count — a clean, brand-consistent design
  (the "My Course" wordmark/logo). It shows **nothing else** — no Lessons,
  Resources, Q&A, or email (guaranteed by the `02` allowlist).
- **Download**: a "Download" button calls `window.print()`; a print stylesheet
  renders the Certificate to a single tidy page (no app chrome / buttons) so
  "Save as PDF" yields a keepable file. Vector-crisp.
- **Bad token** → a plain, uniform not-found (no signal that a Certificate might
  exist), matching the Public-link route posture (`rel="noreferrer"` /
  no-referrer).
- **Reuse in-app**: the same Certificate component backs the "View certificate"
  affordance (`03`) and the celebration's CTA (`04`), so the in-app and public
  views can't drift.

## Depends on

- `02` (the `publicCertificate` read seam + token). Consumed by `03`/`04`.

## Notes

- The `/certificate/[token]` layout mirrors the ungated `/share/[token]` layout;
  reuse that auth-group carve-out rather than inventing a new one.
- Keep the design print-first (margins, no dark-mode-only colours that vanish on
  paper); the artefact is meant to be saved and shown.
- No frontend tests (repo norm); the read-seam correctness is covered in `02`.
  Verify the page + download manually.
- Covers PRD stories 25, 26, 27, 28, 29 (the page side of the uniform not-found).
