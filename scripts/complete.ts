// Terminates a course from the cloud Routine (ADR 0015): marks the Topic
// `completed` so the authoring gate refuses it and the reader stops offering
// "Generate next lesson". Called by the teach skill when the Mission's outcomes
// are substantially met (see teach/SKILL.md "Terminating a Course"); the twin of
// report.ts. Reversible — the owner can reopen the course from the app.
// Usage: pnpm run complete:prod <topicSlug>
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const [topicSlug] = process.argv.slice(2).filter((a) => a !== "--prod");

if (!topicSlug) {
  console.error("Usage: pnpm run complete:prod <topicSlug>");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl(PROD));
await client.mutation(api.content.completeCourse, {
  secret: publishSecret(),
  topicSlug,
});
console.log(`marked "${topicSlug}" completed.`);
