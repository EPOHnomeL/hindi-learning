// Claims one pending translation Edition for this translate-Routine run — the
// sibling of claim.ts (ADR 0008). The fire body is closed, so a fired run can't
// be told its (Topic, language); it calls this, which atomically hands back one
// locked-but-unclaimed job and stamps it claimed. Prints ONLY the slug to stdout
// (or "none") so the run can capture it with `SLUG=$(pnpm -s run claim-translation:prod)`;
// diagnostics go to stderr. The target language and the Topic owner are persisted
// to .env.local (TRANSLATE_LANG / OWNER_EMAIL) for the owner-scoped steps that
// follow (materialise / publish-translation).
// Usage: pnpm run claim-translation:prod
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, persistEnvLocal, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const client = new ConvexHttpClient(convexUrl(PROD));

const claimed = await client.mutation(api.translate.claimTranslation, { secret: publishSecret(), runId });
if (claimed) {
  persistEnvLocal("TRANSLATE_LANG", claimed.lang);
  if (claimed.ownerEmail) persistEnvLocal("OWNER_EMAIL", claimed.ownerEmail);
  console.error(
    `claimed "${claimed.topicSlug}" → ${claimed.lang} (owner ${claimed.ownerEmail ?? "UNKNOWN — set OWNER_EMAIL"}, run ${runId}).`,
  );
  console.log(claimed.topicSlug);
} else {
  console.error("no pending translation to claim — nothing to do.");
  console.log("none");
}
