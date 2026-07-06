# Certificate Emblem & glow-up — slices

Vertical tracer-bullet slices for the [certificate-emblem PRD](./PRD.md). Vocabulary
follows [`CONTEXT.md`](../../CONTEXT.md) (the **Emblem** term); design in
[ADR 0017](../../docs/adr/0017-topic-emblem-on-certificates.md). Ordered by
dependency; the Emblem pipe is proven first, the visual payoff feeds off it.

---

# Slice 1 — Emblem pipe, glyph end-to-end

## Parent

[.scratch/certificate-emblem/PRD.md](./PRD.md)

## What to build

The thinnest complete path for an **Emblem**, using the simplest kind — a
**glyph** — so the whole pipe is proven before images or fetching enter. A glyph
flows from the **Topic**, is frozen onto the **Certificate** at claim, is resolved
by both certificate read seams, and renders on the card.

End-to-end behavior: an owner can set a short glyph (emoji / character) as their
Topic's Emblem; when a learner claims their Certificate the glyph is snapshotted
onto it (a generic default stands in when the Topic has none); the in-app view and
the anonymous `/certificate/<token>` page both show it. A Viewer or non-owner
cannot set it. The card renders the glyph plainly for now — the glow-up is Slice 4.

The read seams return a small discriminated shape so Slice 2 can add the image
kind without reshaping them:

```
emblem: { kind: "glyph"; glyph: string }   // (image kind added in Slice 2)
```

## Acceptance criteria

- [ ] The Topic and the Certificate each carry an optional Emblem glyph; claiming a Certificate freezes the Topic's glyph onto the row (or a generic default when unset).
- [ ] An owner can set / change their Topic's Emblem glyph; a Viewer or non-owner is refused server-side (not just hidden in the UI). The glyph is length-capped.
- [ ] `myCertificate` and `publicCertificate` both return `emblem: { kind: "glyph", glyph }`; the anonymous payload still contains no email, `userId`, `topicId`, or Lesson content.
- [ ] Changing the Topic's glyph after a Certificate is claimed does not alter the earned Certificate's glyph (permanence).
- [ ] The Emblem glyph appears on both the in-app certificate view and the public `/certificate/<token>` page.
- [ ] Convex-seam tests (extending the certificates tests) cover: owner-set + Viewer-refused; claim snapshot + permanence; the read allowlist (glyph present, no PII); the default when unset.

## Blocked by

- None — can start immediately

---

# Slice 2 — Image Emblem via owner upload, end-to-end

## Parent

[.scratch/certificate-emblem/PRD.md](./PRD.md)

## What to build

Extend the pipe from Slice 1 to the **image** Emblem kind, via the owner-upload
path (the AI default comes in Slice 3). An owner uploads an image; it is stored in
the Hub and served **same-origin**; it is frozen onto the Certificate at claim and
resolves ahead of the glyph.

End-to-end behavior: an owner uploads an image as their Topic's Emblem (reusing the
Resource `generateUploadUrl` → upload → record flow); the backend validates it is a
raster within the size cap and rejects SVG / oversize. On claim the image reference
is snapshotted; the read seams resolve it to a same-origin URL
(`emblem: { kind: "image", url }`), else fall back to the glyph, else the default.
The card renders the image with the glyph as fallback. Emblem image blobs are
**immutable** — setting or replacing one mints a new blob and never overwrites an
existing one, so a reference frozen onto an earned Certificate always resolves.

## Acceptance criteria

- [ ] An owner can upload an image as their Topic's Emblem, stored and served same-origin; a Viewer or non-owner is refused server-side.
- [ ] An SVG or over-cap upload is rejected with a clear reason.
- [ ] Claiming a Certificate freezes the image reference; the resolved Emblem (in-app + public) is a same-origin URL.
- [ ] Fallback order holds at claim: image wins over glyph wins over generic default.
- [ ] Replacing or changing the Topic's Emblem after a Certificate is claimed leaves the earned Certificate's Emblem unchanged (the immutable blob still resolves).
- [ ] The anonymous payload with an image Emblem still leaks no email or Lesson content.
- [ ] Convex-seam tests cover: owner image-set + Viewer refused + SVG/oversize rejected; snapshot + permanence across a Topic-Emblem change; fallback order; read returns a same-origin URL with no PII (storage exercised via `convexTest`, as in the resources tests).

## Blocked by

- Slice 1 — Emblem pipe, glyph end-to-end

---

# Slice 3 — AI-fetched default at Completion + teach-skill doc

## Parent

[.scratch/certificate-emblem/PRD.md](./PRD.md)

## What to build

Make the **default** Emblem an image the **Routine** (teach skill) fetches from the
web once when the course reaches **Completion**, without ever clobbering an owner
override.

End-to-end behavior: the secret-guarded completion command is extended to accept an
Emblem — a pre-uploaded image reference plus a fallback glyph. The teach skill
fetches a fitting image for the subject, normalises it (square, size-capped raster),
uploads the bytes, and passes the reference + glyph. An **emblem-source marker**
(e.g. an owner-set flag) makes precedence order-independent: the owner-set path
(Slices 1–2) stamps "owner", and the completion path sets the Emblem only when it
was not owner-set — so the fixed order **owner override → AI image → AI glyph →
generic default** holds regardless of write order. The teach skill's "Terminating a
course" section documents the Emblem step.

## Acceptance criteria

- [ ] The completion command accepts and stores an Emblem (image reference + fallback glyph) on the Topic when a course is completed, and remains publish-secret-guarded.
- [ ] An owner override is never overwritten by the AI default, regardless of which was set first (via the source marker).
- [ ] An owner-ended completion with no Emblem supplied falls back to the AI/subject glyph, or a generic default.
- [ ] The teach skill's "Terminating a course" instructions describe selecting, normalising, and uploading the image and choosing a fallback glyph, and note the owner may override afterwards.
- [ ] Convex-seam tests cover: completion sets the Emblem (image and glyph); an existing owner override is preserved; the path stays secret-guarded.

## Blocked by

- Slice 2 — Image Emblem via owner upload, end-to-end

---

# Slice 4 — Certificate card glow-up (the visual)

## Parent

[.scratch/certificate-emblem/PRD.md](./PRD.md)

## What to build

The user-facing payoff: restyle the single `CertificateCard` into the **hybrid**
treatment — premium on screen, a clean printed document on paper — around whatever
Emblem the earlier slices resolve. CSS-only, no new dependency.

End-to-end behavior: on screen the card shows a metallic **medallion** cradling the
Emblem (image or glyph), a **holographic foil sheen**, and a pointer-tracked
**tilt/spotlight** (a small `mousemove` handler feeding CSS custom properties).
Under `@media print` and `prefers-reduced-motion` it collapses to a flat, motionless
engraved document (colour preserved via `print-color-adjust: exact`). It is styled
for both light and dark themes and applies uniformly across all three surfaces
(in-app view, completion celebration, public page); in the celebration its motion is
composed with the confetti rather than competing with it.

## Acceptance criteria

- [ ] On screen the card shows a medallion around the Emblem, a holographic sheen, and tilts with the pointer.
- [ ] Printing to PDF produces a clean, flat engraved document — no motion artefacts, colours preserved.
- [ ] Under `prefers-reduced-motion` the card is fully static (no sheen animation, no tilt) but still styled.
- [ ] The card renders correctly in both light and dark themes.
- [ ] The same upgraded card appears in the in-app view, the completion celebration, and the public page with no drift, and its motion does not fight the celebration confetti.
- [ ] No new frontend tests — verified manually (consistent with the course-completion / topic-sharing precedent).

## Blocked by

- Slice 2 — Image Emblem via owner upload, end-to-end (so the medallion is styled against both Emblem kinds; can overlap with Slice 3)
