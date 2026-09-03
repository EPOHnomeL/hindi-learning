---
type: task
blocked_by: []
---

> `/wayfinder .plan/maps/media-generation/tickets/04-adr-mux-as-the-video-rail.md`

# Record the ADR: Mux is the product-wide video rail

## Question

[Scope the product onboarding + marketing video](../../media-generation/tickets/03-scope-onboarding-and-marketing-video.md)
chose **Mux** on 2026-08-07, and chose it at full reach: all product video, including
learner-facing course video, not just the one marketing clip. That reach settles the hosting
half of [Video & audio integration](../../authoring/tickets/06-video-and-audio-integration.md),
whose own stated deliverable was that exact comparison.

A decision that closes another map's ticket and sets the cost basis for hours of course
video does not belong buried in a demo ticket's `## Answer`. Write it up as an ADR under
`docs/adr/`, per the repo's decisions convention.

Nothing here re-opens the choice. The decision is made; this ticket is the writing down of
it, honestly, including the parts that were *not* weighed.

## Done when

An ADR exists under `docs/adr/`, numbered per the directory's convention, that records:

- **The decision**: Mux hosts all product video, marketing and learner-facing alike.
- **The alternatives it displaces**, named from
  [rich-media/01](../../authoring/tickets/06-video-and-audio-integration.md): Convex file
  storage, unlisted YouTube, Cloudflare Stream, R2 + CDN with a client-side `<video>`.
- **What actually drove it** — stated plainly: momentum toward doing video properly, decided
  on the strength of one ~50s marketing clip. The paid-marketplace economics that
  rich-media/01 wanted weighed (50/50 on net, a course carrying hours of video) were **not**
  costed before choosing. An ADR that pretends otherwise is worthless later.
- **The unlock criterion for revisiting**: what per-minute or egress number, at what course
  length, would make this the wrong call.
- **Consequences**: Mux needs provisioning (no account, no keys, no `mux` in `package.json`
  or the env as of 2026-08-07); a second rail for the same media type is now a regression,
  not an option.

## Answer

**Written 2026-09-03. The ADR is [`docs/adr/0033-mux-is-the-product-wide-video-rail.md`](../../../../docs/adr/0033-mux-is-the-product-wide-video-rail.md), number 0033**, the next
free number after 0032 and following the house format of the recent ADRs (frontmatter
`status: accepted` with a comment carrying the decided-not-built note, then Context,
Decision, Considered and rejected, Consequences). Nothing was re-opened.

What it records:

- **The decision**: Mux hosts all product video, marketing and learner-facing alike, every
  tenant, every course. A second rail for the same media type is a regression, not an
  option. It also says what the decision does **not** cover: whether uploads are worth
  building, the links-first workflow, and audio, all of which stay with
  [Video & audio integration](../../authoring/tickets/06-video-and-audio-integration.md).
- **The four displaced alternatives**, named with the reason each actually lost: Convex file
  storage (holds bytes, is not a video pipeline, and its hard numbers were never checked),
  unlisted YouTube (leakable link on a paid course, unclear ToS for monetised content,
  someone else's brand inside a whitelabel; still fine as an author-supplied link, just not
  as the product's rail), Cloudflare Stream (the nearest competitor, and the one that would
  most likely have won a costing exercise, so it is flagged as the first place to look on a
  revisit), and R2 plus a CDN with a client-side `<video>` (cheapest, and hands us the whole
  transcoding and playback problem).
- **What actually drove it, stated plainly**: momentum toward doing video properly, on the
  strength of one roughly 50 second marketing clip, for one tenant. The paid-marketplace
  economics are recorded as **not costed**: no per-minute number, no egress estimate, no
  comparison against the platform's 50 percent of net, and the expensive case,
  learner-facing course video, was not modelled at all. The ADR says none of the four
  alternatives lost on a measured number.
- **Consequences**: Mux still needs provisioning; the marketing clip is blocked on it;
  committing an mp4 or serving it from `public/` would be the forbidden second rail; a spend
  alert should be set on day one because nothing meters video spend; and transcripts got
  *harder*, since unlisted YouTube would have supplied captions free and Mux does not.

**The unlock criterion, and it is ESTIMATED, not sourced.** No Mux pricing exists anywhere in
this repo and none was fetched while writing the ADR, so the figures are recalled list prices
for Mux's baseline on-demand tier (about USD 0.0012 per minute delivered, USD 0.003 per minute
of video per month stored, USD 0.04 per minute ingested) at roughly R18 to the dollar. The ADR
labels them ESTIMATED in the table and asks the first session that opens Mux's pricing page to
correct them by superseding note.

The criterion chosen: **revisit when the Mux cost of a single course exceeds 10 percent of the
platform's net share of that course's revenue.** Against the course this product actually
expects, three hours of video sold at R100 with the platform keeping about R50, that 10 percent
line is R5 a sale, and it gives three concrete trip points:

1. **About 1.3 full watch-throughs per buyer.** One watch-through of a three hour course costs
   about R3.90 in delivery, already about 8 percent of the platform's share. Language material
   gets rewatched, so this trips almost immediately. The margin being that thin is itself the
   finding.
2. **Any course longer than about four hours** at a R100 price, at one watch-through per buyer.
3. **About three sales a year per course**, which is what R117 a year of storage per three hour
   course costs. Below that, a course loses money on hosting alone whether anyone watches it
   or not.

**Stale claims: none found, all re-verified in the tree on 2026-09-03.** The ticket's
provisioning assertions were true on 2026-08-07 and are still true four weeks later, so
nothing needed correcting anywhere: no `mux` in `package.json` or `pnpm-lock.yaml`; no `MUX_`
variable named anywhere in `src/`, `convex/`, `scripts/` or `src/env.js` (checked by grepping
for the variable *name* in code only, never by reading `.env`, which is the user's); no
`<video>` element in `src/`; no video rail of any kind shipped, and the only `mux` hits in the
tree are ffmpeg remuxing in `scripts/record-demo.mjs`. The ADR records that re-verification
with its date, so the next reader does not repeat it.

**Decided, NOT built.** Provisioning Mux, adding the env schema entry and putting the
walkthrough mp4 anywhere are all still owed, and none of them belongs to this ticket.

<!-- Moved 2026-09-01 from `media-generation/04` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 15 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
