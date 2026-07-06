# PRD: Certificate Emblem & glow-up

Status: ready-for-agent

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — in particular the new
> **Emblem** term (a Topic's representative mark, snapshotted onto the
> **Certificate**). Design decisions and rejected alternatives are recorded in
> [ADR 0017](../../docs/adr/0017-topic-emblem-on-certificates.md); this PRD is the
> build spec. It extends the shipped
> [course-completion](../course-completion/PRD.md) feature (Completion,
> Certificate, Certificate link) and reuses the Resource upload plumbing.

## Problem Statement

From the learner's / owner's side:

1. **The certificate is generic.** It's a text-only paper card — name, course
   title, lesson count, date. Nothing signals *what* was learned at a glance;
   a Hindi certificate and a Stripe certificate are visually identical. There's
   no mark of the subject.
2. **It doesn't feel special.** For the artefact that caps finishing a whole
   course, the card is flat and static — not something a learner is excited to
   keep, screenshot, or share. It should feel like an achievement.

## Solution

Every Certificate now carries an **Emblem** — a mark of its subject — and a much
richer visual treatment.

The Emblem is resolved when the course reaches **Completion**: by default the
**Routine** (the teach skill) finds a fitting image for the subject and stores it
in the Hub; the **owner** can override with their own uploaded image or a
**glyph** (emoji / short character); and when there is no image, a subject glyph
stands in. Whatever it resolves to is **frozen onto the Certificate** the moment
it's claimed, so a later reopen or re-fetch never alters an earned Certificate.
Every image is served **same-origin** — the anonymous `/certificate/<token>` page
never calls out to a third party.

The card itself gets a **hybrid** glow-up: on screen, a metallic **medallion**
cradles the Emblem, a **holographic foil sheen** plays across it, and it **tilts**
subtly as the pointer moves — while printing to PDF collapses it to a clean,
engraved paper document. It stays the warm paper/gold identity of the lessons, so
it still belongs to the product, and it degrades to a flat, motionless document
under `@media print` and `prefers-reduced-motion`. No new dependency — CSS plus a
tiny pointer handler.

## User Stories

### Seeing the subject on the certificate
1. As a learner, I want my Certificate to show a mark of the subject I studied, so that it's obvious at a glance what I completed.
2. As a learner, I want that mark to be a real image where possible (not just a letter), so that the certificate feels specific to my course.
3. As a learner, if no image is available, I want a fitting glyph (emoji / symbol) to stand in, so that the certificate never looks broken or blank.
4. As a Viewer who earned a Certificate on a course shared with me, I want it to carry the same subject Emblem as the owner's, so that it represents the subject, not who I am.

### The AI-chosen default
5. As the teach skill, when I declare a course complete, I want to supply a representative image and a fallback glyph for the subject, so that the certificate has a fitting Emblem by default with no owner effort.
6. As the teach skill, I want to normalise the image to a small square raster and upload the bytes myself, so that the backend just stores them and the certificate prints predictably.
7. As the system, I want the Emblem image fetched exactly once at completion and stored in the Hub — never hot-linked at render — so that the anonymous certificate page stays self-contained, leak-free, and printable.
8. As an owner who ended my own course manually (no model in the loop), I want a sensible fallback Emblem (a subject glyph, or a generic default), so that a manually-completed course still gets an Emblem.

### The owner override
9. As an owner, I want to set my own image as my course's Emblem, so that I can pick exactly the mark I want.
10. As an owner, I want to set a glyph (emoji / short character) as the Emblem instead, so that I can keep it simple without hunting for an image.
11. As an owner, I want the AI's choice pre-filled so I only change it if I care, so that the default path stays effortless.
12. As an owner, I want my override to take precedence over the AI's choice, so that my decision wins.
13. As a Viewer, I never get to set or change a shared course's Emblem, so that only the owner curates the subject's mark.
14. As an owner, I want an oversized or non-image (e.g. SVG) upload rejected with a clear reason, so that I can't accidentally set something that won't render safely or print.

### Permanence
15. As a learner, I want the Emblem frozen onto my Certificate when I claim it, so that it's part of the immutable record.
16. As a learner, if the owner later changes the course's Emblem (or the course is reopened and a new image fetched), I want my already-earned Certificate to keep its original Emblem, so that my proof isn't rewritten.
17. As a learner, I want my Certificate's Emblem to always load, so that it can't 404 out from under an earned certificate.

### The anonymous certificate page
18. As anyone with a Certificate link, I want to see the Emblem alongside the name, course, date, and lesson count, so that the shared proof is recognisable and attractive.
19. As anyone opening the certificate page, I want the Emblem image served from the same site (not a third party), so that opening it doesn't leak my visit to another service.
20. As anyone with a wrong or made-up token, I still get a uniform not-found, so that certificates can't be enumerated — unchanged by the Emblem.
21. As anyone viewing a Certificate, I still never see the course's Lessons, Resources, Q&A, or the learner's email — the payload grew by only the Emblem, so that the achievement-only guarantee holds.

### The glow-up visual
22. As a learner, I want my certificate to look premium on screen — a metallic medallion around the Emblem, a holographic sheen, a subtle tilt as I move my pointer — so that it feels like a real achievement.
23. As a learner, I want the certificate to still print to a clean, professional PDF (no motion, no glossy artefacts), so that a printed/attached copy reads as a proper document.
24. As a motion-sensitive learner, I want the animation and tilt suppressed under `prefers-reduced-motion`, so that I get the beautiful static card without movement.
25. As a learner, I want the same upgraded card wherever it appears — the in-app view, the completion celebration, and the public page — so that the certificate is consistent everywhere.
26. As a learner on the completion celebration, I don't want the card's own motion to fight the confetti, so that the moment feels composed, not chaotic.
27. As a learner in dark mode, I want the certificate to look right in both themes, so that it's beautiful whichever theme I'm using.

## Implementation Decisions

- **`topics` gains an Emblem; `certificates` freezes a snapshot of it.** The
  Topic carries the live Emblem (an image reference into Hub file storage, plus a
  glyph string); the `certificates` row carries a frozen copy captured at claim,
  alongside the existing `courseTitle` / `lessonCount` snapshots. The Emblem is a
  property of the *subject* (the Topic), so every learner's Certificate for that
  Topic shows the same one.
- **The Emblem resolves in a fixed fallback order:** owner override → AI-fetched
  image → AI-chosen glyph → generic default. The first present wins at claim time.
- **The AI default rides the existing secret-guarded completion path.** The
  teach-skill completion command ([content.ts](../../convex/content.ts),
  publish-secret-guarded like `reportGeneration`) is extended to accept an Emblem:
  an already-uploaded image reference and a fallback glyph. The teach skill
  **fetches and normalises the image (square raster, size-capped) and uploads the
  bytes** using the same `generateUploadUrl` flow Resources use, then passes the
  resulting storage reference — so the backend performs **no external fetch and no
  image processing**; it only stores/records what it's handed.
- **An owner emblem-set mutation**, authed and owner-only (through the existing
  owner gate; a Viewer is refused server-side regardless of UI). For an image it
  reuses `generateUploadUrl` → client uploads → mutation records the reference on
  the Topic; for a glyph it records the string. It **validates** the image is a
  raster (rejects SVG) and within the size cap, and validates the glyph is short.
- **Emblem image blobs are immutable.** Setting or re-fetching an Emblem mints a
  **new** blob and never overwrites an existing one, so a `storageId` frozen onto
  an earned Certificate always resolves. Emblem blobs are therefore retained (not
  cascade-deleted) while any Certificate references them.
- **`claimCertificate` snapshots the Topic's Emblem** onto the new row at mint,
  exactly as it already snapshots title and lesson count. Idempotency is
  unchanged — a second claim returns the existing row with its original Emblem.
- **The read seams resolve the Emblem to a small discriminated shape.** Both the
  authed `myCertificate` and the anonymous `publicCertificate`
  ([certificates.ts](../../convex/certificates.ts)) return
  `emblem: { kind: "image"; url } | { kind: "glyph"; glyph }` — an image resolves
  its stored blob to a **same-origin** URL (`ctx.storage.getUrl`), a glyph returns
  the string. This **widens the public output allowlist by exactly one field**;
  the guard's invariant is preserved because a same-origin image URL / short glyph
  carries no email and no Lesson content. A missing/invalid token still returns
  uniform `null`.
- **One `CertificateCard`, upgraded, still feeds all three surfaces** (in-app
  view/claim dialog, completion celebration, public page). Its data type carries
  the resolved `emblem`. The visual is **CSS-only**: a metallic medallion holding
  the Emblem (image or glyph), a holographic foil sheen, and a pointer-tracked
  **tilt/spotlight** (a small `mousemove` handler feeding CSS custom properties).
  All motion is gated off under `@media print` and `prefers-reduced-motion`; the
  print path also flattens the treatment to an engraved document and opts into
  colour with `print-color-adjust: exact`. No new dependency (consistent with
  ADR 0015's rejection of framer-motion). The card is styled for both light and
  dark themes.
- **Teach-skill instructions.** The teach skill's "Terminating a course" section
  gains an Emblem step: pick a representative image for the subject, normalise +
  upload it, choose a fallback glyph, and pass both to the completion command;
  note the owner may override afterwards.

## Testing Decisions

- **Good tests assert external behavior at the Convex function seam** — not
  internals — in the style of `certificates.test.ts`, `public.test.ts`, and
  `resources.test.ts`: seed Users/Topics/Lessons/Progress with `t.run`, act as a
  caller with `withIdentity`, set `PUBLISH_SECRET` in `beforeAll`, and (for the
  image path) store a blob via the test harness — `convexTest` already exercises
  `_storage` in `resources.test.ts` / `routine.test.ts` / `sharing-readonly.test.ts`,
  so no live network fetch is needed.
- **One load-bearing seam: the Convex function API**, exercised via `convexTest`,
  extending `certificates.test.ts`. Covered:
  - **Emblem ingest** — the secret-guarded completion command records an Emblem
    (image reference + glyph) on the Topic; the owner emblem-set mutation records
    one when authed as the owner, and is **refused for a Viewer / non-owner**; an
    SVG or over-cap image is rejected. Prior art: `routine.test.ts` secret tests,
    `resources.test.ts` upload/record + `shares`/`sharing-readonly` owner-gate tests.
  - **Claim snapshot & permanence** — `claimCertificate` freezes the Topic's
    Emblem onto the row; changing the Topic's Emblem (or reopening + re-fetching)
    afterward leaves an earned Certificate's Emblem unchanged and un-re-minted.
    Prior art: the existing permanence-across-reopen test.
  - **Fallback ordering** — seed the combinations (owner override present / only
    AI image / only glyph / neither) and assert the claimed Certificate carries
    the expected Emblem per the fixed order.
  - **Read + allowlist** — `publicCertificate` and `myCertificate` return the
    resolved `emblem` (a same-origin URL for an image via `ctx.storage.getUrl`, or
    the glyph string) for a valid token, and the payload **never** includes the
    email, userId, topicId, or any Lesson content; a wrong/absent token returns
    `null`. Prior art: `public.test.ts` / existing `publicCertificate` allowlist
    tests.
- **No new frontend tests** — consistent with the repo (course-completion,
  topic-sharing precedent). The medallion / holographic sheen / pointer-tilt,
  print-to-PDF rendering, dark-mode appearance, and the owner emblem-set UI are
  verified manually; the correctness that matters (who can set an Emblem, that it
  freezes, what the public link exposes) is enforced and tested at the Convex
  seam.

## Out of Scope

- **Server-side image processing / normalisation.** The image is normalised to a
  square, size-capped raster **before upload** (teach skill for the AI default;
  client for the owner path); the backend only validates type/size and stores.
  A server-side resize pipeline is deferred.
- **Live / render-time image fetching or external hot-linking.** The Emblem image
  is fetched once at completion and served same-origin; the anonymous page never
  calls a third party.
- **Moderation of the Emblem image.** Unmoderated in v1 (private alpha: the teach
  skill is the operator's own, and an owner curates their own certificate). A
  moderation/allowlist pass is a later concern if the surface opens up.
- **SVG / vector emblems.** Raster only, for anonymous-page safety and print
  predictability.
- **Surfacing the Emblem beyond the Certificate.** It is stored Topic-wide but, in
  this change, shown only on the Certificate. Adopting it on the dashboard
  switcher / reader header is a cheap follow-up, not this PRD.
- **Re-minting a Certificate to pick up a new Emblem.** One immutable Certificate
  keeps its original Emblem, like every other snapshotted field.
- **Changing who can earn / how Completion works.** Eligibility, the claim flow,
  the celebration's trigger, and the completion/gate mechanics are unchanged from
  the course-completion feature — this PRD only adds the Emblem and the visual.

## Further Notes

- The feature is a thin extension of a shipped area: two new snapshotted fields
  (on `topics` and `certificates`), an Emblem argument on the existing completion
  command, one owner emblem-set mutation (reusing Resource upload plumbing), a
  one-field widening of the two certificate read seams, and a CSS-heavy redesign
  of the single `CertificateCard`. The only genuinely new behaviour is
  fetch-once-at-completion + same-origin storage, kept off the request path and
  out of the anonymous render.
- Live Convex queries mean the upgraded card and its Emblem surface automatically
  once the seams return the new field — no extra sync work.
- The single-component design (one `CertificateCard`) keeps the in-app view,
  celebration, and public page from drifting, exactly as in the course-completion
  feature.
- No prototype was needed; every design question resolved in the grilling session
  (see ADR 0017).
