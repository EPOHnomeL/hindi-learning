// One-off admin op: clone a ready Edition's translated content + owner-granted
// access (shares/pendingShares) into a brand-new language code. Wraps the
// secret-guarded translate.cloneEdition mutation the same way the other admin
// scripts wrap their seams (probe-editions.ts, publish-translation.ts).
// Usage: pnpm tsx scripts/clone-edition.ts --topic <slug> --from <lang> --to <lang> [--prod]
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret, topicArg } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const slug = topicArg();

function argAfter(flag: string): string {
  const i = process.argv.indexOf(flag);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || v.startsWith("--")) {
    console.error(`Missing ${flag} <value>`);
    process.exit(1);
  }
  return v;
}

const fromLang = argAfter("--from");
const toLang = argAfter("--to");

const client = new ConvexHttpClient(convexUrl(PROD));
console.log(`Cloning "${slug}" ${fromLang} → ${toLang} on ${PROD ? "PROD" : "dev"}…`);
const result = await client.mutation(api.translate.cloneEdition, { secret, topicSlug: slug, fromLang, toLang });
console.log(`translations=${result.translations} shares=${result.shares} pendingShares=${result.pendingShares}`);
