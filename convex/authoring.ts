// Pure authoring helpers for the OpenRouter path (ADR 0014) — the filesystem-less
// twin of the CLI publish path (scripts/publish.ts). The action calls a model,
// then uses these to wrap the lean fragment into a stored document, read its
// title/supersession, name the lesson, and parse the model's structured output.
// Kept pure + dependency-light so they unit-test without a live model or ctx.db.
import { LESSON_FOOT, LESSON_HEAD, TEACH_INSTRUCTIONS } from "./authoringAssets.generated";
import type { ChatMessage } from "./openrouterClient";
import { shuffleQuizOptions } from "./quizShuffle";

// The display title: the text after " · " in `<title>Lesson N · <display></title>`
// (see AUTHORING.md §1). Mirrors scripts/publish.ts `titleFrom`.
export function titleFrom(html: string): string {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const parts = raw.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : raw).trim();
}

// The retired lesson key from a `<meta name="supersedes">`, if present.
export function supersedesFrom(html: string): string | undefined {
  return html.match(/<meta\s+name=["']supersedes["']\s+content=["']([^"']+)["']/i)?.[1];
}

// Wrap a lean lesson fragment into a complete, self-contained document — the same
// shape scripts/publish.ts `assembleLesson` produces, but from the bundled
// partials (LESSON_HEAD/LESSON_FOOT) instead of the filesystem. The quiz options
// are shuffled with the shared deterministic helper so the answer position stays
// balanced. An already-complete document is passed through untouched.
export function assembleLesson(raw: string): string {
  const fragment = raw.trim();
  if (/<!DOCTYPE|<html[\s>]/i.test(fragment)) return raw; // already complete
  const title = fragment.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? "";
  const supersedes = fragment.match(/<meta\s+name=["']supersedes["'][^>]*>/i)?.[0] ?? "";
  const content = shuffleQuizOptions(
    fragment
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+name=["']supersedes["'][^>]*>/i, "")
      .trim(),
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${title}
${supersedes}
${LESSON_HEAD}
</head>
<body>
<div class="wrap">
${content}
</div>
${LESSON_FOOT}
</body>
</html>
`;
}

// Dash-case a display title into a slug (AUTHORING.md §1 numbering).
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// The next lesson key: zero-padded seq + dash-cased title, e.g. "0002-the-aorist".
export function nextLessonKey(seq: number, title: string): string {
  return `${String(seq).padStart(4, "0")}-${slugify(title) || "lesson"}`;
}

export type AuthoringResult = {
  lessonHtml: string;
  learningRecord: string;
  estimatedLessons?: number;
};

// The single-pass output contract: the model returns one JSON object with the
// lean lesson fragment, its learning record markdown, and an optional ~N estimate.
// Tolerates a surrounding ```json code fence (models love to add one). Throws on
// anything that isn't a usable lesson, so the action reports `failed`.
export function parseAuthoringResult(raw: string): AuthoringResult {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let obj: unknown;
  try {
    obj = JSON.parse(unfenced);
  } catch {
    throw new Error("authoring: response was not valid JSON");
  }
  const o = obj as Record<string, unknown>;
  if (typeof o.lessonHtml !== "string" || o.lessonHtml.trim() === "") {
    throw new Error("authoring: missing lessonHtml");
  }
  if (typeof o.learningRecord !== "string") {
    throw new Error("authoring: missing learningRecord");
  }
  const estimate =
    typeof o.estimatedLessons === "number" && Number.isFinite(o.estimatedLessons)
      ? Math.max(1, Math.round(o.estimatedLessons))
      : undefined;
  return { lessonHtml: o.lessonHtml, learningRecord: o.learningRecord, estimatedLessons: estimate };
}

// ---- Prompt building --------------------------------------------------------

// The materialised context the action injects (subset of routine.materialiseForProvider).
export type MaterialisedContext = {
  topic: { slug: string; title: string; status: string; mission: string | null; seed: string | null };
  lessons: { key: string; seq: number; title: string; html: string }[];
  learningRecords: { key: string; seq: number; markdown: string }[];
  references: { key: string; title: string; html: string }[];
  capture: {
    openQuestions: { id: string; lessonKey: string; text: string }[];
    responses: { lessonKey: string; quizId: string; answer: string; correct: boolean }[];
    progress: { lessonKey: string; status: string }[];
  };
  frontier: { key: string; seq: number } | null;
};

// The single-pass output contract, appended to the ported teach instructions.
// There's no filesystem, so the model returns ONE JSON object instead of writing
// files — parseAuthoringResult reads it back.
const OUTPUT_CONTRACT = `

# === OUTPUT CONTRACT (single-pass, no filesystem) ===

You are running in a single pass with NO filesystem — you cannot write files or
run tools. Instead of writing lesson/record files, return EXACTLY ONE JSON object
and nothing else (no prose, no code fence), with these fields:

- "lessonHtml": the next lesson as a LEAN HTML FRAGMENT per AUTHORING.md — content
  only, first line \`<title>Lesson N · <display title></title>\`. Do NOT include
  <!DOCTYPE>, <html>, <head>, <style>, <body>, <div class="wrap">, or any
  <script>; those are wrapped on automatically. Keep the quiz markup exactly.
- "learningRecord": the lesson's learning-record markdown per LEARNING-RECORD-FORMAT.md.
- "estimatedLessons": your best whole-number estimate of the course's eventual
  total lesson count (a number).`;

// Compact, readable serialisation of the course so far — the ZPD evidence the
// generator judges the next step from (AUTHORING.md §8). Full HTML only for the
// Frontier lesson (a style/continuity anchor); prior lessons as a title list to
// stay within the action's size/time budget.
function serializeContext(c: MaterialisedContext): string {
  const frontierHtml = c.frontier ? c.lessons.find((l) => l.key === c.frontier!.key)?.html ?? "" : "";
  const lines = [
    `## Course: ${c.topic.title} (${c.topic.slug})`,
    `Status: ${c.topic.status}`,
    c.topic.mission ? `\n### Mission\n${c.topic.mission}` : c.topic.seed ? `\n### Seed ("why")\n${c.topic.seed}` : "",
    `\n### Lessons so far (${c.lessons.length})`,
    c.lessons.length ? c.lessons.map((l) => `- ${l.key} (seq ${l.seq}): ${l.title}`).join("\n") : "(none yet)",
    frontierHtml ? `\n### Frontier lesson HTML (style + continuity anchor)\n${frontierHtml}` : "",
    `\n### Learning records`,
    c.learningRecords.length ? c.learningRecords.map((r) => `#### ${r.key}\n${r.markdown}`).join("\n\n") : "(none yet)",
    `\n### References`,
    c.references.length ? c.references.map((r) => `#### ${r.title} (${r.key})\n${r.html}`).join("\n\n") : "(none yet)",
    `\n### Learner capture`,
    `Progress: ${JSON.stringify(c.capture.progress)}`,
    `Quiz responses: ${JSON.stringify(c.capture.responses)}`,
    `Open questions: ${JSON.stringify(c.capture.openQuestions)}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// The bootstrap mission-drafting contract, appended to the teach instructions for
// step 1 of setup. The model returns ONE JSON object `{ "mission": "<markdown>" }`
// per MISSION-FORMAT.md — no filesystem to write MISSION.md to.
const MISSION_CONTRACT = `

# === OUTPUT CONTRACT (mission draft, single-pass) ===

Draft the course's Mission from the learner's seed ("why") and any resources.
Return EXACTLY ONE JSON object and nothing else: { "mission": "<the Mission as
markdown per MISSION-FORMAT.md>" }.`;

// Read the drafted mission back from step 1's response. Fence-tolerant; throws on
// anything that isn't a non-empty mission so the setup run reports `failed`.
export function parseMissionResult(raw: string): { mission: string } {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let obj: unknown;
  try {
    obj = JSON.parse(unfenced);
  } catch {
    throw new Error("mission: response was not valid JSON");
  }
  const mission = (obj as Record<string, unknown>).mission;
  if (typeof mission !== "string" || mission.trim() === "") throw new Error("mission: missing mission text");
  return { mission };
}

// Build the chat messages for bootstrap step 1: draft the Mission from the seed +
// resources (web search enabled by the caller). System = teach instructions +
// mission contract; user = the serialised context + the task.
export function buildMissionMessages(c: MaterialisedContext): ChatMessage[] {
  return [
    { role: "system", content: TEACH_INSTRUCTIONS + MISSION_CONTRACT },
    {
      role: "user",
      content: `${serializeContext(c)}

# Task

Draft this course's Mission from the learner's seed ("why") and any resources
above. Return the single JSON object per the output contract.`,
    },
  ];
}

// Build the chat messages for the ongoing single-pass authoring of the NEXT
// lesson (the course already has a Frontier). System = ported teach instructions
// + output contract; user = the serialised context + the task.
export function buildOngoingMessages(c: MaterialisedContext): ChatMessage[] {
  const nextSeq = (c.frontier?.seq ?? 0) + 1;
  return [
    { role: "system", content: TEACH_INSTRUCTIONS + OUTPUT_CONTRACT },
    {
      role: "user",
      content: `${serializeContext(c)}

# Task

Author lesson number ${nextSeq} — the next step on this learner's ZPD, grounded in
the context above. Return the single JSON object per the output contract.`,
    },
  ];
}
