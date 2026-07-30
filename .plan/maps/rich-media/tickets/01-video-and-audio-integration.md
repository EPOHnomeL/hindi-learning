---
type: grilling
blocked_by: []
---

# Video & audio integration (embedding, ingestion, hosting, teach mode)

## Question

Merged from 9 separate scope tickets (formerly [rich-media/01](01-video-and-audio-integration.md), #91–#98) — image/poster Resources,
media embedded in Lessons, YouTube link embed, transcript ingestion, transcription
fallback, uploaded-video hosting, video-anchored teach mode, provider-path ingestion, and
Editions × embedded media are facets of one **video & audio integration** effort, not nine
independent features. User's framing when requesting this: **"Video and audio integration."**
(Resource *deep-linking* — [rich-media/11](11-resource-links-spec.md) — is a separate concern: linking to a course's own uploaded
documents, not video/audio playback — left un-merged.)

---

## Why

The Resource pipeline is already media-agnostic — blob + sha256 dedupe
([`convex/resources.ts:14`](../../../../convex/resources.ts#L14)), materialise writes raw bytes to
the workspace, and Claude Code reads images natively. The only hard blocker is the upload UI:
both inputs accept PDF/markdown only
([`CourseShell.tsx:438`](../../../../src/app/_components/CourseShell.tsx#L438),
[`Dashboard.tsx:628`](../../../../src/app/_components/Dashboard.tsx#L628)). Cheapest ticket in the
set, but the type/size policy decided here constrains every later media ticket.

## Questions to answer

- Which image types and what size cap? (Certificate emblem upload already accepts
  `png/jpeg/webp` — reuse that policy?)
- Does `resources.kind` need widening (e.g. `image`) or is the filename extension enough for
  the Routine and the sidebar? Schema change vs. zero-migration inference.
- Do image Resources need a thumbnail/preview in the Resource sidebar, or is the existing
  signed-URL "open" link enough for v1?
- Is a "poster" just an image Resource, or Topic-level art? The [[Emblem]] already covers
  course-level imagery — check for overlap before inventing a second concept.
- Privacy: strip EXIF (location data) on upload, or accept as-is for the private alpha?

## Out of scope

- Embedding images *inside* Lessons (ticket 02). This ticket is grounding-sources only.
- Video files entirely (ticket 06).

## Deliverable

A short decision note (types, cap, schema yes/no, poster = image Resource or not) plus the
acceptance-criteria list for the implementation ticket.

---

## Why

Lessons are self-contained HTML fragments whose bodies live as content blobs served over
[`GET /content?id=`](../../../../convex/http.ts) (immutable caching, storageId as bearer
capability). Embedding an image/poster *inside* a Lesson needs a convention for how an
authored lesson references media that only becomes a storage id at publish time — today
[`publish.ts`](../../../../scripts/publish.ts) uploads lesson HTML only.

## Questions to answer

- Is storageId-as-capability acceptable for lesson-embedded media? (Same authorization model
  as lesson HTML itself — anyone with the lesson body already holds the media ids inside it —
  so presumably yes, but say so explicitly.)
- Publish flow: the teach skill authors `<img src="./assets/foo.png">` locally — does publish
  rewrite local asset paths to `/content?id=` after uploading each asset, or do lessons
  reference already-uploaded Resource blobs directly? What does materialise do on the way back
  down (round-trip fidelity)?
- Immutability: lessons are immutable — are their embedded media blobs immutable too
  (mint-new-never-overwrite, like the Emblem pattern)? What deletes them when a lesson is
  superseded or a Topic deleted?
- Size discipline: cap per-image and per-lesson total so the reader stays fast.
- Does the `/content` route need `Content-Type` handling beyond HTML (it serves whatever the
  blob's stored type is — verify for images)?

## Out of scope

- Video embeds (tickets 03/06) — this ticket is the generic blob-in-lesson mechanism, scoped
  to images first.

## Deliverable

The authoring→publish→materialise convention written up as a draft AUTHORING.md section, plus
a decision on lifecycle/immutability. Likely feeds an ADR alongside ADR 0009.

---

## Why

[`addUrlResource`](../../../../convex/resources.ts#L68) already records any URL, so a YouTube
link is a valid Resource today with zero changes. What needs scoping is making it *useful*:
recognising it as a video, showing something better than a bare link, and defining the embed
component Lessons will use (which ticket 07's teach mode builds on).

## Questions to answer

- Classification: detect YouTube (and generic video?) URLs at add time and store a subkind, or
  infer at render? Subkind on the row survives URL-shape changes; inference needs no migration.
- Metadata: fetch oEmbed (title, duration, thumbnail) at add time (mutation can't fetch — needs
  an action) or lazily via the Routine into `processed`? What does the Resource sidebar show?
- Embed component: an `assets/` component wrapping the iframe — `youtube-nocookie.com`?
  `?start=&end=` segment params (load-bearing for ticket 07)? Fallback link when embedding is
  disabled by the video owner?
- Reader constraints: any CSP/frame-ancestors policy on the reader that blocks iframes? What
  does a [[Guest]] on a Public link see (iframe works logged-out, but confirm)?
- Non-YouTube video URLs (Vimeo, raw .mp4 links): in scope now or explicitly later?

## Out of scope

- Transcript fetching (ticket 04) — this ticket is the link/embed/metadata surface only.
- Teach-mode authoring policy (ticket 07).

## Deliverable

Decision note: classification approach, metadata strategy, embed component spec (props:
videoId, start, end), and the v1 answer for non-YouTube URLs.

---

## Why

Without a transcript the Routine cannot ground teaching in a video ("never trust your
parametric knowledge"), so this is the load-bearing component for video-anchored courses. The
lazy-ingestion slot already exists — `processed` manifest +
[`cacheProcessedResource`](../../../../convex/resources.ts#L131) (idempotent, keyed by
contentHash) — so this scopes *what fills it and how reliably*.

## Questions to answer

- Fetch mechanism for YouTube captions: timedtext endpoint, yt-dlp, or a third-party
  transcript API? **Key risk to de-risk first:** YouTube aggressively blocks datacenter IPs —
  test the chosen mechanism *from the cloud Routine's environment*, not a dev machine.
- Fallback chain when fetch fails: third-party API (cost?), owner-supplied transcript upload
  (a file Resource paired to the video?), or mark failed and teach without it?
- Manifest shape: transcript text, timed segments/chapters `{start, end, text}`, source
  language, caption provenance (manual vs auto — auto-caption quality affects trust). Ticket
  07 consumes this shape; agree it here.
- When does ingestion run — lazily at first materialise (current design intent, issue-06
  pattern) or eagerly at add time? Eager gives the learner early feedback that their video is
  usable; lazy is less plumbing.
- Failure UX: a Resource stuck `raw`/`processing` is invisible today — does the sidebar need a
  "couldn't ingest" state?

## Out of scope

- Caption-less videos / speech-to-text (ticket 05).
- Uploaded video files (ticket 06) — assume a YouTube/URL source here.

## Deliverable

A tested (spiked) answer on fetch reliability from the Routine's IP range, the chosen
mechanism + fallback chain, and the agreed `processed` manifest schema.

---

**Depends on:** 04

## Why

Some videos have no captions at all; grounding then needs audio → text (speech-to-text). This
is a genuinely different component from caption fetching — an external STT service with real
per-hour cost, an audio-extraction step, and its own failure modes. Per the gated-phases
philosophy, the first question is whether to build it at all yet.

## Questions to answer

- **Defer entirely?** What fraction of the videos we actually expect (Hindi-learning content,
  lecture recordings) lack captions? If small, v1 answer may be "unsupported — tell the owner
  to pick a captioned video or upload a transcript". Define the demand signal that unlocks
  building it.
- If built: which STT service (Whisper-class API) and cost per audio-hour? Hindi/multilingual
  accuracy matters for this app specifically.
- Audio extraction: yt-dlp from the Routine's environment hits the same datacenter-IP blocking
  as ticket 04 — and pulling audio (not just captions) leans harder on YouTube ToS. Take an
  explicit position.
- Output must land in the *same* `processed` manifest shape agreed in ticket 04, so ticket 07
  never cares which path produced the transcript.

## Out of scope

- Anything for videos that *have* captions (ticket 04).

## Deliverable

A build/defer decision with the unlock criterion; if build, the service choice, cost estimate,
and where it runs.

---

## Why

Convex file storage will hold video bytes but is not a video pipeline: per-file upload limits
likely reject long recordings, there's no transcoding or adaptive streaming, and every reader
streaming from the Hub bills bandwidth. The working recommendation is **links-first, defer
uploads** — but that's a decision to record (likely an ADR), not assume.

## Questions to answer

- Verify the hard numbers: Convex per-file upload limit, range-request support on signed URLs
  (seek/scrub needs it), and storage + egress pricing at plausible video sizes. This kills or
  keeps the "just use Convex storage" option factually.
- External rails, cost/effort compared: unlisted YouTube (free hosting + captions, owner does
  the upload, ToS questions for a paid product), Cloudflare Stream, Mux, R2 + CDN with
  client-side `<video>`. Which fits the paid-marketplace economics (50/50 on net) when a
  course carries hours of video?
- What's the **demand signal** that unlocks building uploads at all? (Gated-phases: someone
  who can't use a link.) Until then, is "upload your video to YouTube unlisted and paste the
  link" an acceptable documented workflow?
- If a rail is chosen later: where do transcripts come from for uploaded files (no YouTube
  captions — forces ticket 05)?

## Out of scope

- YouTube-link handling (tickets 03/04) — that path needs no hosting decision.
- Building any upload UI.

## Deliverable

An ADR draft: links-first vs. an upload rail, with the verified Convex numbers, the comparison
table, and the unlock criterion for revisiting.

---

**Depends on:** 03, 04

## Why

The product idea: a course built *on top of* a video + transcript, where each Lesson embeds
one video segment plus quizzes and supporting content, and the next segment is released as the
learner demonstrates understanding of the previous one. The gating machinery already exists —
the [[Frontier]] buffer-of-one plus quiz Responses in `CAPTURE.json` — so this is expected to
be teach-skill/AUTHORING.md **prompt policy, not schema**. Scope confirms that and writes the
policy.

## Questions to answer

- Curriculum planning: how does the teach skill turn a timed transcript (ticket 04's manifest)
  into a segment plan — transcript chapters, concept boundaries, target segment length? Where
  is the plan recorded (a learning record? NOTES.md?) so successive Routine runs stay
  consistent?
- Lesson shape: one segment per Lesson via the ticket-03 embed component (`start`/`end`),
  retrieval quizzes on *that segment*, citations pointing at timestamps. Draft the
  AUTHORING.md section.
- Remediation policy: "understands the previous concept" — is completing the Frontier enough,
  or do poor quiz Responses make the Routine author a remediation Lesson (re-using the same
  segment or a re-explanation) before advancing the video? Today's gate is completion-only;
  remediation is already possible as authoring policy — say when to use it.
- Mixed grounding: video + the Topic's other Resources (handbook PDF etc.) — how do they
  interleave?
- Interaction with `estimatedLessons` and [[Completion]]: course length is roughly bounded by
  video coverage — does the estimate come from the segment plan? Completion when the video is
  exhausted and outcomes met?

## Out of scope

- Any transcript/embed plumbing (tickets 03/04) — consume their outputs.
- New schema or gating tables (the null hypothesis is none are needed; scoping must prove it).

## Deliverable

A draft AUTHORING.md/SKILL.md section for video-anchored Topics plus the remediation policy,
validated against one real video end-to-end by hand (materialise → author two lessons →
check the gate story holds).

---

## Why

A Topic's `provider` (ADR 0014) selects who authors: the Claude Routine runs on a real machine
(shell, yt-dlp, page renderers — where lazy ingestion was designed to live), while the
OpenRouter path authors inside Convex actions —
[`openrouter.ts`](../../../../convex/openrouter.ts) — with no shell and tight runtime limits.
Video/media ingestion therefore doesn't port automatically to the BYOK/OpenRouter line, and
that asymmetry should be a decision, not a surprise.

## Questions to answer

- V1 position: are media/video features **Claude-line-only** (documented support-matrix gap),
  or must both providers work from day one?
- If both: move ingestion out of authoring time — e.g. ingest at add time (a Convex action
  fetching captions may work; anything needing a shell won't) so *any* author just reads a
  ready `processed` manifest. What subset of tickets 03–05 is action-compatible?
- Can the OpenRouter author even consume the manifest well (transcript in-context vs. context
  budget of GLM-class models on long videos)? Chunking policy?
- Does the support matrix belong in ADR 0014 as an amendment, or a new ADR?

## Out of scope

- Implementing either path's ingestion (tickets 04/05 own the mechanics).

## Deliverable

A provider support-matrix decision (which media features on which line, and why) recorded
against ADR 0014.

---

**Depends on:** 02, 03

## Why

An [[Edition]] is a translated projection of lesson/reference HTML
([`translate.ts`](../../../../convex/translate.ts)). Once Lessons embed images and video
iframes, the translate run rewrites bodies that now contain media markup — the media itself
stays source-language while the prose around it translates. Mostly fine, but it needs deciding
deliberately, and the translator must not mangle embeds.

## Questions to answer

- Robustness: does the LLM translate pass preserve `<img>`/`<iframe>` markup byte-exact
  (src/start/end params untouched)? Does the prompt need an explicit "leave media elements
  unchanged" rule + a post-check?
- What *should* translate: alt text and captions/figure text (yes, presumably); quiz text
  around a video segment (yes); the transcript-derived quotes inside a lesson (yes — they're
  prose)?
- Video language: a Hindi-teaching video embedded in a Spanish Edition still speaks its source
  language. Acceptable and stated? YouTube's own auto-translated captions can be hinted via
  embed params (`cc_lang_pref`) — worth wiring, or noise?
- Do image blobs ever need per-language variants (text-in-image)? Null hypothesis: no —
  document as a known limitation.
- `sourceHash` semantics: media-only lesson changes (new blob id, same prose) — should they
  invalidate translations?

## Out of scope

- The embed/publish mechanics themselves (tickets 02/03).
- Any new translation infrastructure.

## Deliverable

A short policy note: what translates, what's preserved verbatim, the prompt/post-check rule
for embed markup, and stated limitations (media stays source-language).

## Done when

Every facet of the merged scope has a decision: media type/size policy, the in-lesson embed mechanism, YouTube embed, transcript ingestion and its caption-less fallback, uploaded-video hosting, video-anchored teach mode, the provider-path matrix, and Editions x embedded media.

<!-- Migrated 2026-07-30 from GitHub issue #88 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
