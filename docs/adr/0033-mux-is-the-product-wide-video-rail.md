---
# Decided 2026-08-07 in media-generation/03, written up 2026-09-03. NOT built: Mux
# is not provisioned, there is no account, no key and no `mux` dependency, and no
# product video is served from anywhere yet. An ADR is never rewritten to correct
# it; a stale one gets a superseding ADR.
status: accepted
---

# Mux is the product-wide video rail, chosen on one 50 second clip

All product video goes to Mux: the marketing walkthrough that prompted the choice
and, at full reach, learner-facing course video too. There is no second rail. This
was decided on 2026-08-07 inside
[media-generation/03](../../.plan/maps/media-generation/tickets/03-scope-onboarding-and-marketing-video.md),
a ticket scoping a single marketing clip, and it was taken knowingly at a reach far
past that ticket. It closes the hosting half of
[authoring/06](../../.plan/maps/authoring/tickets/06-video-and-audio-integration.md),
whose stated deliverable was exactly this comparison.

## Context

Two separate pieces of work wanted video, and only one of them did the choosing.

`authoring/06` (formerly `rich-media/01`) owned the hosting question properly. Its
brief was to compare Convex file storage, unlisted YouTube, Cloudflare Stream, Mux
and R2 plus a CDN, and to ask which of them fits the paid marketplace economics,
50 percent of net to the platform, when a course carries hours of video. That
comparison was never run.

`media-generation/03` was scoping the pre-signup marketing walkthrough for the
ywampotch tenant. A prototype was walked on 2026-08-06 and the resolution on
2026-08-07 settled that the deliverable is an mp4, roughly 50 seconds, nine beats,
rendered locally by `scripts/record-demo.mjs`. A file needs somewhere to live, the
session reached for Mux, and it deliberately extended the choice to all product
video rather than leaving a second rail decision open for course video later.

So the decision that sets the cost basis for hours of learner-facing video was made
while scoping under a minute of marketing footage.

## Decision

1. **Mux hosts all product video.** Marketing and learner-facing alike, every
   tenant, every course. Playback, storage and transcoding are Mux's.
2. **A second rail for the same media type is a regression, not an option.** If a
   later feature wants video somewhere else, that is a change to this ADR by a
   superseding one, not a parallel implementation. Two rails for one media type is
   the outcome this decision exists to prevent.
3. **This says where bytes live, nothing more.** It does not decide that uploads
   are worth building, and it does not decide the links first workflow. Those stay
   with `authoring/06`, which was narrowed rather than closed.
4. **Audio is not covered.** This ADR is about video. Course audio has its own
   scoping ticket and is not bound here.

## What actually drove it, stated honestly

Momentum, and an intent to do video properly rather than cheaply. Mux is the
obvious professional answer for a product that expects to stream video, it removes
the transcoding and adaptive-bitrate problem entirely, and nobody wanted the
marketing clip's first impression to be a stuttering `<video>` tag over a
signed URL.

That is the whole of it. In particular:

- **The marketplace economics were not costed.** No per-minute delivery number, no
  storage number, no egress estimate, no comparison of any of them against the
  platform's 50 percent of net on a course sale. The comparison `authoring/06`
  asked for does not exist and was not consulted, because it was never done.
- **The evidence base was one clip.** Roughly 50 seconds of hand-authored marketing
  footage, for one tenant, served to anonymous visitors on a landing page. At that
  size any of the five candidates would have worked and the cost difference between
  them is rounding error.
- **Learner-facing course video, which is the expensive case, was not modelled at
  all.** Hours per course, watched repeatedly, stored indefinitely whether the
  course sells or not.

An ADR that dressed this up as a costed comparison would be worthless the first
time somebody checked it against a bill. The unlock criterion below exists because
the arithmetic was skipped, not because it was done and came out fine.

## Considered and rejected

Named from `authoring/06`, which is where they were enumerated. None of these was
rejected on measured numbers; each was rejected on the reasoning recorded here.

- **Convex file storage.** Holds bytes, is not a video pipeline. No transcoding, no
  adaptive bitrate, per-file upload limits that plausibly reject a long recording,
  range-request support on signed URLs unverified, and every learner streaming from
  the Hub bills Hub bandwidth. Those hard numbers were never checked, and after this
  decision they no longer need checking, because Convex storage is out.
- **Unlisted YouTube.** Free hosting, free captions, owner does the upload, and the
  transcript path the Routine wants comes for free. Rejected on the shape of the
  product rather than the cost: a paid course whose video sits on an unlisted
  YouTube URL is one leaked link away from being unpaid, the ToS position for
  monetised content is at best unclear, and the player is somebody else's brand
  inside a whitelabelled tenant. Still the documented workflow for author-supplied
  links; it is rejected as the *product's* rail, not as a link a course can carry.
- **Cloudflare Stream.** The nearest competitor and the one that would most likely
  have won a costing exercise, since its per-minute-delivered price and its bundled
  storage model are the direct comparison Mux invites. It lost on nothing that was
  measured. Naming it here is the point: if this decision is ever revisited, this is
  the first place to look.
- **R2 plus a CDN with a client-side `<video>`.** Cheapest by storage and egress,
  and it puts the whole transcoding, thumbnailing, adaptive-bitrate and playback
  problem back on us. Rejected as work we do not want to own, which is a real
  reason, just not a costed one.

## The unlock criterion for revisiting

This is the number that makes the decision falsifiable. **All figures below are
ESTIMATED, not sourced.** No Mux pricing exists anywhere in this repo, and none was
fetched while writing this. They are recalled list prices for Mux's baseline
on-demand tier, and the first session that opens Mux's pricing page should correct
them in a superseding note.

Estimated inputs, at roughly R18 to the dollar:

| Item | Estimated Mux price | In ZAR |
| --- | --- | --- |
| Delivery | 0.0012 USD per minute delivered | about R0.022 per minute |
| Storage | 0.003 USD per minute of video per month | about R0.054 per minute per month |
| Encoding | 0.04 USD per minute ingested, once | about R0.72 per minute |

Applied to the course this product actually expects, a three hour course, 180
minutes, sold at R100 with the platform keeping 50 percent of net, so about R50 a
sale:

- **One buyer watching the whole course once costs about R3.90 in delivery**, which
  is roughly 8 percent of the platform's share of that sale.
- **Storage costs about R9.70 a month, about R117 a year, per course**, and it is
  charged whether the course sells or not.

**The criterion: revisit this decision when the Mux cost of a single course exceeds
10 percent of the platform's net share of that course's revenue.**

Three concrete trip points, any one of which is enough:

1. **Watch-through.** At the estimates above the 10 percent line is R5 a sale, and
   one full watch-through already costs about R3.90. So the criterion trips at
   about **1.3 full watch-throughs per buyer** on a three hour course at R100. A
   course learners rewatch, which is the normal behaviour for language material,
   trips it immediately. The margin here is thin, and that is the finding.
2. **Course length.** At one watch-through per buyer, the same R5 line is crossed by
   **any course longer than about four hours** at a R100 price.
3. **Catalogue drag.** At about R117 a year of storage per three hour course, a
   course needs **about three sales a year just to pay its own storage**. A
   catalogue where the median course sells fewer than three copies a year is losing
   money on hosting alone, independently of anything about delivery.

If any of those hold once real numbers replace these estimates, Cloudflare Stream
is the first alternative to price, and R2 plus a CDN is the floor to compare
against.

## Consequences

- **Mux needs provisioning, and none of it exists.** Verified in the tree on
  2026-09-03: no `mux` in `package.json` or `pnpm-lock.yaml`, no `MUX_` variable
  named anywhere in the source or in `src/env.js`, no `<video>` element in `src/`,
  and no video rail of any kind shipped. Account, keys, env schema entry and an
  upload path are all still owed. The claim `media-generation/03` made on
  2026-08-07 holds unchanged four weeks later.
- **The marketing clip is blocked on that provisioning.** `scripts/record-demo.mjs`
  produces the mp4 today; there is nowhere approved to put it. Committing an mp4 to
  the repo or serving it from `public/` would be the second rail this ADR forbids.
- **A cost surprise is possible and is not currently visible.** Nothing meters video
  spend, and the estimates above say the marketplace margin on a video-heavy course
  is thin. Whoever provisions the account should set a Mux spend alert on day one;
  that is cheaper than the ADR being wrong quietly.
- **`authoring/06` keeps the questions Mux does not answer**: the demand signal that
  unlocks building uploads at all, whether "upload to YouTube unlisted and paste the
  link" stays the documented workflow, and where transcripts come from for uploaded
  files, since an uploaded file has no YouTube captions to fetch and therefore
  forces the speech-to-text question.
- **Transcripts got harder, not easier.** Unlisted YouTube would have supplied
  captions free. Mux does not, so every uploaded video the Routine must teach from
  needs a transcript from somewhere else. That cost was not weighed either.
