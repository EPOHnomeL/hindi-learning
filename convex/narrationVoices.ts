// The narrators a learner can choose between, per Edition language. (Plain
// module, no Convex functions registered here, so the reader, the server and the
// operator CLI can all import the one list.)
//
// All are Kokoro voices (Kokoro-82M, Apache 2.0), rendered on the operator's own
// machine by `scripts/narrate.ts` and uploaded, never synthesized on demand. The
// ids are Kokoro's own, because that is what the render tool is asked for by name.
// Kokoro's second letter is the voice's sex (`m` or `f`), which is how the reader
// labels them "male" and "female".
//
// English chosen by the repo owner on 2026-11-24, replacing the ElevenLabs pilot's
// single voice. Hindi (hm_omega, hf_alpha) chosen by the owner on 2026-11-27 from
// samples of prophetic-school lesson 1 (docs/narration-tts-by-language.html). A
// language with no entry is not narrated. The FIRST entry is what a learner hears
// before they have picked.
export const NARRATION_VOICES_BY_LANG: Readonly<Record<string, readonly string[]>> = {
  en: ["am_michael", "bf_emma"],
  hi: ["hm_omega", "hf_alpha"],
};

// The source (English) Edition's voices, which every caller used before Hindi.
export const NARRATION_VOICES = ["am_michael", "bf_emma"] as const;

export function narrationVoices(lang: string): readonly string[] {
  return NARRATION_VOICES_BY_LANG[lang] ?? [];
}

// Part of every recording's identity in `lessonAudio`, beside the voice: a later
// model would be a different recording of the same lesson, not the same one.
export const NARRATION_MODEL = "kokoro-v1.0";

export function isNarrationVoice(v: string | undefined | null, lang = "en"): v is string {
  return narrationVoices(lang).includes(v ?? "");
}
