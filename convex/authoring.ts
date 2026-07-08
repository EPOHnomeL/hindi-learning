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

// Strip a surrounding ```json code fence (models love to add one) and parse. One
// place so every structured-output parser agrees. Throws on invalid JSON.
function parseFencedJson(raw: string, what: string): Record<string, unknown> {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(unfenced) as Record<string, unknown>;
  } catch {
    throw new Error(`${what}: response was not valid JSON`);
  }
}

// Dash-case a display title into a slug (AUTHORING.md §1 numbering).
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// The next lesson key: zero-padded seq + dash-cased title, e.g. "0002-the-aorist".
export function nextLessonKey(seq: number, title: string): string {
  return `${String(seq).padStart(4, "0")}-${slugify(title) || "lesson"}`;
}

export type AuthoringReply = { questionId: string; reply: string };
export type AuthoringReference = { key: string; title: string; html: string };
export type AuthoringResult = {
  // The run's terminate judgement (issue 05): the mission is substantially met /
  // ZPD exhausted, so complete the course instead of authoring.
  complete: boolean;
  // Present unless `complete` — the next lesson + its record.
  lessonHtml?: string;
  learningRecord?: string;
  estimatedLessons?: number;
  // Batched answers to the open questions passed in context.
  replies: AuthoringReply[];
  // Glossary/reference docs to upsert (AUTHORING.md §7), so lessons that cross-link
  // to /references/<key> don't dangle. Stored as-authored (not head/foot wrapped).
  references: AuthoringReference[];
};

// The single-pass output contract: the model returns one JSON object carrying the
// terminate judgement, the next lesson (+ record) unless complete, an optional ~N
// estimate, and batched replies. Tolerates a surrounding ```json code fence.
// Throws on anything that isn't a usable authoring result, so the action reports
// `failed`.
export function parseAuthoringResult(raw: string): AuthoringResult {
  const o = parseFencedJson(raw, "authoring");
  const complete = o.complete === true;
  if (!complete) {
    if (typeof o.lessonHtml !== "string" || o.lessonHtml.trim() === "") {
      throw new Error("authoring: missing lessonHtml");
    }
    if (typeof o.learningRecord !== "string") {
      throw new Error("authoring: missing learningRecord");
    }
  }
  const estimate =
    typeof o.estimatedLessons === "number" && Number.isFinite(o.estimatedLessons)
      ? Math.max(1, Math.round(o.estimatedLessons))
      : undefined;
  const replies: AuthoringReply[] = Array.isArray(o.replies)
    ? (o.replies as unknown[])
        .map((r) => r as Record<string, unknown>)
        .filter((r) => typeof r.questionId === "string" && typeof r.reply === "string")
        .map((r) => ({ questionId: r.questionId as string, reply: r.reply as string }))
    : [];
  const references: AuthoringReference[] = Array.isArray(o.references)
    ? (o.references as unknown[])
        .map((r) => r as Record<string, unknown>)
        .filter((r) => typeof r.key === "string" && typeof r.title === "string" && typeof r.html === "string")
        .map((r) => ({ key: r.key as string, title: r.title as string, html: r.html as string }))
    : [];
  return {
    complete,
    lessonHtml: typeof o.lessonHtml === "string" ? o.lessonHtml : undefined,
    learningRecord: typeof o.learningRecord === "string" ? o.learningRecord : undefined,
    estimatedLessons: estimate,
    replies,
    references,
  };
}

// ---- Prompt building --------------------------------------------------------

// The materialised context the action injects (subset of routine.materialiseForProvider).
export type MaterialisedContext = {
  topic: { slug: string; title: string; status: string; mission: string | null; seed: string | null };
  lessons: { key: string; seq: number; title: string; html: string }[];
  learningRecords: { key: string; seq: number; markdown: string }[];
  references: { key: string; title: string; html: string }[];
  resources: { filename: string; kind: string; url: string | null; processed: unknown }[];
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

- "complete": boolean. First judge the course against the Mission's "Success looks
  like" outcomes. Set true ONLY when they are substantially met or the ZPD is
  genuinely exhausted — then OMIT "lessonHtml"/"learningRecord" (the course is
  finished). NEVER set true for a lifelong / open-ended mission. Otherwise false.
- "lessonHtml": (required unless complete) the next lesson as a LEAN HTML FRAGMENT
  per AUTHORING.md — content only, first line
  \`<title>Lesson N · <display title></title>\`. Do NOT include <!DOCTYPE>, <html>,
  <head>, <style>, <body>, <div class="wrap">, or any <script>; those are wrapped
  on automatically. Keep the quiz markup exactly.
- "learningRecord": (required unless complete) the lesson's learning-record
  markdown per LEARNING-RECORD-FORMAT.md.
- "estimatedLessons": your best whole-number estimate of the course's eventual
  total lesson count (a number).
- "replies": array of { "questionId": "<id from the Open questions above>",
  "reply": "<answer>" } for any open learner questions you can answer now. Use []
  if there are none.
- "references": array of { "key": "<dash-case-key>", "title": "<title>",
  "html": "<reference HTML, as-authored — NOT head/foot wrapped>" } for any
  glossary/reference docs this lesson relies on or cross-links to
  (/courses/<slug>/references/<key>), per AUTHORING.md §7. Include a reference for
  every /references/<key> you link so no link dangles. Use [] if none.`;

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
    // The learner's own uploaded/linked primary sources — ground claims in these
    // (AUTHORING.md §6). A single-pass model can't fetch URLs, so it works from any
    // extracted `processed` text; the filename/URL still tells it what exists.
    `\n### Resources (learner's primary sources)`,
    c.resources.length
      ? c.resources
          .map((r) => `- ${r.filename} [${r.kind}]${r.url ? ` ${r.url}` : ""}${r.processed ? `\n${JSON.stringify(r.processed)}` : ""}`)
          .join("\n")
      : "(none)",
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
  const obj = parseFencedJson(raw, "mission");
  const mission = obj.mission;
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

First judge whether the mission is met (set "complete" accordingly — never for an
open-ended mission). If not complete, author lesson number ${nextSeq} — the next
step on this learner's ZPD, grounded in the context above. Answer any open
questions in "replies". Return the single JSON object per the output contract.`,
    },
  ];
}
