// Answers an open question. The reply appears inline in the reader and the
// question flips to "answered".
// Usage: pnpm run reply <question-id> "<your answer>"
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const [questionId, reply] = process.argv.slice(2).filter((a) => a !== "--prod");
if (!questionId || !reply) {
  console.error('Usage: pnpm run reply <question-id> "<your answer>"');
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl(PROD));
await client.mutation(api.capture.replyToQuestion, {
  secret: publishSecret(),
  questionId: questionId as Id<"questions">,
  reply,
});
console.log(`replied to ${questionId}.`);
