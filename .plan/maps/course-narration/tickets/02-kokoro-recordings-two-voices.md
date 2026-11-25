---
type: task
blocked_by: []
claimed_by: claude-1ee12cbe
claimed_at: 2026-11-24T22:59:16+02:00
---
# Replace the ElevenLabs render with uploaded Kokoro recordings, in two voices

## Question

The owner's instruction, 2026-11-24, in his words and in order:

1. "for my-course we can let users choose between kokoro michael and kokoro emma"
2. "take out george out of my course and make it locally and upload directly via
   mcp for the prophetic school."

So the ElevenLabs narration ("George") leaves the course. `prophetic-school` is
narrated on the operator's own machine with Kokoro, an open speech model, in two
voices, Michael (`am_michael`) and Emma (`bf_emma`), and the finished mp3s are
uploaded. This ticket is the rail: text out, audio in, the right recording served.
Letting a learner CHOOSE between the two is the picker,
[ticket 03](03-the-voice-picker.md), which is a UI question and has its own.

"Via MCP" cannot be done literally and the owner should hear that plainly: the
repo's `.mcp.json` has an empty `mcpServers`, and the Convex plugin's MCP server
timed out connecting in the session that built this. The repo's own operator route
does the same job: PUBLISH_SECRET-guarded Convex functions called from
`scripts/narrate.ts` with `ConvexHttpClient`.

What has to be true, concretely:

- Nothing on the server calls a speech provider any more. `speak`, `voices`,
  `precompute`, the env readers and the sample budget go, and so does
  `scripts/voices.ts`.
- A recording is identified by lesson, language, voice and model. The table
  already keys on all of them, so two voices are two rows and no schema change.
- A recording is served only when it is of the lesson AS IT READS NOW
  (`sourceStorageId` equals the lesson's current body), in a current voice, under
  the current model.
- **The gate becomes "a recording exists and the reader would show you the
  lesson".** Nobody can commission audio from the reader, so the admin-only render
  permission and the `PILOT_SLUG` constant have nothing left to guard. This WIDENS
  who the code would serve the day another course gets audio: any reader of that
  course, not only `prophetic-school`'s. Because of that it has to be the reader's
  own rule and not a looser cousin: the Edition the caller is actually served
  (English only), the paywall (`lessonLocked`), no superseded lessons. An
  independent review on 2026-11-24 found the first draft let a holder of only a
  translated Edition, and an administrator with no grant, fetch English audio.
- The old recordings stop being served on deploy but stay in storage until
  `lessonAudio:purgeRetired` is run with `apply`, which needs the owner's explicit
  yes: it deletes audio he paid ElevenLabs for, and it cannot be undone.

**Progress, 2026-11-25.** Deployed to production on the owner's "push" (commit
`6952080`). The first `--push` uploaded 66 recordings (lessons 1 to 33, both
voices) with none refused, and a second run reported all 66 already there, so
`saveUpload` and `uploaded` are now proven against the real deployment, not only
in tests. The render was killed once by a laptop restart (11:28) and restarted;
it is resumable. The owner asked for lessons to come online as they are rendered,
so a second detached loop, `.narration/autopush.ps1`, runs `--push` whenever the
count of finished mp3s grows. The three `ELEVENLABS_*` variables that were set on
production are removed. The purge ran the same day on his plain "yes purge": a
dry run counted 3 retired rows of 69 (George's), `apply` deleted them, and a
second dry run counted 0. So `purgeRetired` is proven on the real deployment too.

**What is left is machine time, not code:** the render (67 of 112 at 16:36) and
the uploads. The owner was on mobile data, so the uploader was stopped with
`.narration\STOP-PUSH` after the first 66; on wifi, delete that file and start
`.narration\autopush.ps1` again (and `.narration\render.ps1` if the laptop has
restarted). Both pick up where they left off.

## Done when

- `pnpm narrate:prod --topic prophetic-school` pulls every lesson's narration
  script, and `--push` uploads whatever mp3s exist locally and the deployment
  lacks. Both resumable.
- All 56 lessons of `prophetic-school` have a current recording in both voices on
  production, and a learner hears one when they press play.
- `convex/lessonAudio.test.ts` pins who hears a recording and exactly which blobs
  an upload or a purge may delete.
- The owner has answered the purge question, and the four dead `ELEVENLABS_*`
  production env vars are removed or deliberately kept.
