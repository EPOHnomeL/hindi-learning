---
status: proposed
---

# Topic Emblem on Certificates

A Topic now carries an **Emblem** — a representative mark for its subject — that
is snapshotted onto the **Certificate** and drives a richer, "21st.dev-cool"
certificate visual. By default the Emblem is an **image the Routine fetches from
the web once when the course completes** and stores in the Hub (served
same-origin); it falls back to a **glyph** (an emoji / short character) when
there is no image, and the **owner** may override the default with their own
uploaded image or glyph.

## Context

The certificate shipped in [ADR 0015](0015-course-completion-and-certificates.md)
is a warm paper/serif card carrying only the learner name, course title, lesson
count, and issue date. The ask: make it "sooo much cooler" and put an *icon of
the subject* on it, ideally sourced "from the internet."

"From the internet" collides head-on with four properties ADR 0015 deliberately
locked in, all of which we intend to keep:

1. The anonymous `/certificate/[token]` page is **self-contained** — the repo
   fetches *zero* external images anywhere (no `next/image`, no
   `remotePatterns`), and the page is `no-referrer` / `noindex`.
2. A Certificate is an **immutable frozen snapshot** — a later reopen/extend of
   the Topic must never mutate an earned Certificate.
3. `publicCertificate` returns an **explicit output allowlist** as a security
   guard (name, title, date, count) — never the email or any Lesson content.
4. **Minimal dependencies**; the card **prints to a clean PDF** (ADR 0015
   rejected framer-motion, html2canvas, jsPDF in this very area).

## Decision

- **The Emblem is a property of the Topic (the subject), snapshotted onto the
  Certificate.** It belongs to the subject, so an owner's and a Viewer's
  certificates for the same Topic show the same Emblem. Stored on `topics`;
  frozen onto the `certificates` row at claim, exactly as `courseTitle` and
  `lessonCount` already are. It is *stored* Topic-wide but, in this change,
  *surfaced* only on the certificate (reader/dashboard adoption is a cheap
  follow-up).
- **Default is an AI-fetched image, resolved once at Completion.** The Routine
  already runs the teach loop and calls `completeCourse` with web tools in hand.
  It supplies an image (URL or bytes) **and** a representative fallback glyph; a
  Convex **action** fetches the bytes server-side and stores them in the Hub's
  `_storage`. The anonymous page then serves the image **same-origin** — never
  hot-linked at render. This is invisibly identical to "AI grabbed an image from
  the web" while keeping the public page self-contained, leak-free, and
  printable.
- **Emblem blobs are immutable; the Certificate freezes a `storageId`.** A
  reopen + re-fetch mints a *new* blob and never overwrites the old one, so the
  `storageId` snapshotted onto an earned Certificate always resolves. The glyph
  is snapshotted alongside it as the fallback.
- **Fallback order: owner override → AI image → AI glyph → generic default.**
  An owner-ended completion (no model in the loop) or a failed fetch falls back
  to the AI-chosen (or, absent that, a generic 🎓 / title-derived) glyph.
- **The owner may override with their own uploaded image or glyph** (reusing the
  Resource upload plumbing → `_storage`, or an emoji/short-string field). Same
  storage and same-origin serving as the AI default — one code path.
- **Images are square rasters, size-capped; SVG is rejected.** Normalise to a
  square PNG/WebP, capped (~256², ~100 KB). SVG is refused: on an anonymous page
  it is an XSS vector, and as a raster `<img>` an emblem is inert and prints
  predictably.
- **The public output allowlist is widened by exactly one safe field.**
  `publicCertificate` (and `myCertificate`) return a resolved Emblem — an
  `emblem: { kind: "image"; url } | { kind: "glyph"; glyph }`. A same-origin
  storage URL or a short glyph string carries no PII and no Lesson content, so
  the guard's invariant holds.
- **Visual: a hybrid treatment — screen-wow that degrades to a printed
  document.** The warm paper/gold identity stays as the base (so the certificate
  still belongs to the product and prints as a document), but the *materials* are
  pushed up: a metallic **medallion/seal** cradling the Emblem, a holographic
  foil **sheen**, and a pointer-tracked **tilt/spotlight** on screen. All of it
  degrades to a flat engraved paper document under `@media print` and
  `prefers-reduced-motion`. **CSS-only** (a ~10-line pointer handler for the
  tilt) — no new dependency. The single `CertificateCard` still feeds all three
  surfaces (in-app dialog, celebration, public page); the print variant applies
  only on the public page.

## Considered Options

- **Hot-link the found image URL live at render** — rejected: leaks IP/referer to
  a third party on every anonymous view, prints unreliably, and breaks the frozen
  snapshot when the URL changes or 404s.
- **AI-fetched image as a *render-time* default** — same failure mode as
  hot-linking; rejected in favour of fetch-once-at-completion + same-origin store.
- **Glyph only, no image** — rejected: the ask is for real subject imagery; a
  glyph alone is the fallback, not the ceiling.
- **Full 21st.dev pivot (dark-glass / aurora / holographic card)** — rejected:
  weaker as a printed document and further from the paper-toned lessons brand.
  The hybrid keeps the document identity and prints cleanly.
- **A new animation dependency (framer-motion / motion)** — rejected, consistent
  with ADR 0015: CSS keyframes + a tiny pointer handler cover the sheen and tilt.
- **Store the Emblem only on the Certificate (not the Topic)** — rejected: the
  Emblem is a property of the subject shared by every learner's certificate for
  that Topic; storing it on the Topic and snapshotting mirrors `courseTitle`.
- **Allow SVG emblems** — rejected on the anonymous page (XSS surface); raster
  only.

## Consequences

- **New outbound fetch of external content into the Hub.** `completeCourse`
  (via a Convex action) now pulls an external image and stores it — the first
  time the platform ingests third-party bytes for display. It runs at completion,
  off the request path, and stores same-origin.
- **The anonymous surface now serves an owner/AI-supplied image.** Unmoderated
  in v1; accepted for the private alpha (the teach skill is the operator's own,
  and owner uploads are the owner's own certificate). A moderation/allowlist pass
  is a future concern if the surface opens up.
- **The output allowlist grew by one field.** The guard still returns no email
  and no Lesson content; a same-origin image ref / short glyph is safe to expose.
- **Reopen keeps the original certificate's frozen Emblem**, like every other
  snapshotted field — immutable blobs guarantee the frozen `storageId` resolves.
- **Print must opt into colour.** The gold/foil treatment needs
  `print-color-adjust: exact`; motion and the tilt are disabled under `@media
  print` and `prefers-reduced-motion`, leaving a flat engraved document.
