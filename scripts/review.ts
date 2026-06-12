// Reads the live learner's state from the Convex Hub: open questions plus
// per-lesson quiz responses and progress. Run at the start of a teach session.
// Usage: pnpm run review
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const client = new ConvexHttpClient(convexUrl(PROD));
const state = await client.query(api.capture.reviewState, { secret: publishSecret() });

console.log("\n=== OPEN QUESTIONS ===");
if (state.openQuestions.length === 0) {
  console.log("(none)");
} else {
  for (const q of state.openQuestions) {
    console.log(`\n[${q.id}]  (${q.lessonKey})`);
    console.log(`  ${q.text}`);
  }
  console.log("\nAnswer each with:  pnpm run reply <question-id> \"<your answer>\"");
}

const lessons = new Set<string>([
  ...state.responses.map((r) => r.lessonKey),
  ...state.progress.map((p) => p.lessonKey),
]);

console.log("\n=== PER-LESSON RESPONSES & PROGRESS ===");
if (lessons.size === 0) {
  console.log("(no activity yet)");
} else {
  for (const lessonKey of [...lessons].sort()) {
    const prog = state.progress.find((p) => p.lessonKey === lessonKey)?.status ?? "—";
    const responses = state.responses.filter((r) => r.lessonKey === lessonKey);
    const right = responses.filter((r) => r.correct).length;
    console.log(`\n${lessonKey}  [${prog}]  ${right}/${responses.length} correct`);
    for (const r of responses) {
      console.log(`  ${r.correct ? "✓" : "✗"} ${r.quizId}: ${r.answer}`);
    }
  }
}
console.log("");
