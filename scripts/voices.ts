// Which ElevenLabs voices can the deployment's API key actually use?
//
// The narration pilot's first real press was refused with a 402 because its
// default voice was a Voice Library voice and the account is on the free plan,
// which can only drive Default/premade voices through the API. Which ids qualify
// is a property of the account, not of a doc page, so this asks it.
//
//   pnpm voices            (dev)
//   pnpm voices:prod       (live)
//
// Read-only. Prints `category` first, because that is the column that predicts a
// 402: anything other than `premade` may be refused on a free plan.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const client = new ConvexHttpClient(convexUrl(PROD));

const list = await client.action(api.lessonAudio.voices, { secret: publishSecret() });
if (list.length === 0) {
  console.log("No voices returned. The key is valid but the account has none available.");
} else {
  const usable = list.filter((v) => v.category === "premade");
  console.log(`${list.length} voices on ${PROD ? "PROD" : "dev"} (${usable.length} premade):\n`);
  for (const v of [...list].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))) {
    console.log(`  ${v.category.padEnd(14)} ${v.voiceId}  ${v.name}`);
  }
  if (usable[0]) {
    console.log(`\nA free-plan-safe pick:\n  npx convex env set ELEVENLABS_VOICE_ID ${usable[0].voiceId}   # ${usable[0].name}`);
  }
}
