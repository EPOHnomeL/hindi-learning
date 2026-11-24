// The narrators a learner can choose between. (Plain module, no Convex functions
// registered here, so the reader, the server and the operator CLI can all import
// the one list.)
//
// Both are Kokoro voices (Kokoro-82M, Apache 2.0), rendered on the operator's own
// machine by `scripts/narrate.ts` and uploaded, never synthesized on demand. The
// ids are Kokoro's own, because that is what the render tool is asked for by name.
//
// Chosen by the repo owner on 2026-11-24, replacing the ElevenLabs pilot's single
// voice. The FIRST entry is what a learner hears before they have picked.
export const NARRATION_VOICES = ["am_michael", "bf_emma"] as const;
export type NarrationVoice = (typeof NARRATION_VOICES)[number];

// What the picker calls each one. Proper names, so they are not translated.
export const NARRATION_VOICE_NAMES: Record<NarrationVoice, string> = {
  am_michael: "Michael",
  bf_emma: "Emma",
};

// Part of every recording's identity in `lessonAudio`, beside the voice: a later
// model would be a different recording of the same lesson, not the same one.
export const NARRATION_MODEL = "kokoro-v1.0";

export function isNarrationVoice(v: string | undefined | null): v is NarrationVoice {
  return (NARRATION_VOICES as readonly string[]).includes(v ?? "");
}
