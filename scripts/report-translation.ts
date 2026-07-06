// Reports the outcome of a translate-Routine run back to the Hub, releasing the
// per-Edition lock the Editions panel watches — the sibling of report.ts. Called
// by the run as its LAST step, including on failure (in a finally). "ready" makes
// the Edition usable (any item not published falls back to English and is counted
// failed); "failed" surfaces a retry.
// Usage: pnpm run report-translation:prod <ready|failed> <topicSlug> [lang] ["error"]
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const [outcome, topicSlug, langArg, error] = process.argv.slice(2).filter((a) => a !== "--prod");
const lang = langArg ?? process.env.TRANSLATE_LANG;

if ((outcome !== "ready" && outcome !== "failed") || !topicSlug || !lang) {
  console.error('Usage: pnpm run report-translation:prod <ready|failed> <topicSlug> [lang] ["error message"]');
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl(PROD));
await client.mutation(api.translate.reportTranslation, { secret: publishSecret(), topicSlug, lang, outcome, error });
console.log(`reported ${outcome} for "${topicSlug}" → ${lang}.`);
