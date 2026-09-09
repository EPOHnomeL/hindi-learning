// A thin, env-configured wrapper over Google's native Gemini Developer API
// (AI Studio key) `generateContent` endpoint. Sibling of `openrouterClient.ts`,
// same dependency-free `fetch` seam (tests stub fetch), one operator key, no SDK,
// no per-user keys — the app-LLM-free stance holds (ADR 0014).
//
// Why a second client at all: OpenRouter's unified `reasoning: { effort: "none" }`
// is silently ignored for Gemini endpoints — the opt-out 400s and the OpenRouter
// client retries with thinking back ON, so every translation still bills thinking
// tokens as output (translation-cost 05). The native API exposes `thinkingConfig`,
// so we can pin reasoning to the floor. NOTE: Gemini 3.x (the default 3.5-flash)
// has NO "off" — the 2.5-era `thinkingBudget: 0` is deprecated and doesn't disable
// thinking on 3.x; the least-reasoning option is `thinkingLevel: "minimal"`, which
// is what we send. So thinking is minimised, not zero — expect some thought tokens
// still billed (logged below via `usageMetadata.thoughtsTokenCount`).
// Used ONLY by the translate path; authoring stays on OpenRouter/GLM.
//
// Live smoke: the test env has no key (tests mock `fetch`). To smoke-test for real,
// set `GOOGLE_AI_API_KEY` on the Convex deployment (`npx convex env set GOOGLE_AI_API_KEY …`)
// and fire a translation; `npx convex logs` shows the round-trip.

const endpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Env-overridable, defaulting to the same model the OpenRouter path ran — now on
// the native API with thinking pinned to `minimal`. Swap via `GEMINI_TRANSLATE_MODEL`
// for a cheaper tier (e.g. `gemini-2.5-flash-lite`) without a code change; on a 2.5
// model that rejects `thinkingLevel`, the retry below drops the control.
export const geminiTranslateModel = (): string => process.env.GEMINI_TRANSLATE_MODEL ?? "gemini-3.5-flash";

// The shared policy (key, post-once-retry-once, errors, usage) lives in
// `convex/modelCall.ts` since 2026-09-08 (ticket 31). What is left here is the
// Gemini wire format: this endpoint, this key header, `systemInstruction` split
// out of the turn list, `thinkingLevel` as the thinking control, and where
// Gemini puts content and token counts.
//
// The usage is no longer logged and dropped. `complete` normalises it and both
// rails log it the same way, so the translate rail can now SEE its token spend.
// **Persisting it is deliberately still not done here.** Ticket 12 instruments
// Routine RUNS in `generationRuns`, per Topic; a translation job is a different
// unit with its own `translationJobs` row and no usage columns, so recording it
// is schema work on that table and belongs to its own ticket rather than to this
// refactor.
import { complete, usageFrom, type ChatMessage, type ModelAdapter, type ModelReply } from "./modelCall";

// Kept as an alias so the two clients' message types stay interchangeable by
// construction rather than by both happening to be spelled the same way.
export type GeminiMessage = ChatMessage;

const gemini: ModelAdapter = {
  vendor: "gemini",
  keyEnv: "GOOGLE_AI_API_KEY",
  request(key, req, dropReasoning) {
    // Gemini splits the system prompt out of the turn list into `systemInstruction`.
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const body: Record<string, unknown> = { contents };
    // Gemini 3.x has no "off": the 2.5-era `thinkingBudget: 0` is deprecated and
    // does not disable thinking, so `minimal` is the floor. Thinking is
    // minimised, not zero, and some thought tokens are still billed.
    if (!dropReasoning) body.generationConfig = { thinkingConfig: { thinkingLevel: "minimal" } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    return {
      url: endpoint(req.model),
      init: {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      },
    };
  },
  // Always sent, unlike OpenRouter's, because this client exists precisely to
  // pin the thinking control and has nothing to do without it.
  sendsReasoningControl: () => true,
  isReasoningComplaint: (body) => /think/i.test(body),
  parse(json): ModelReply {
    const j = json as {
      candidates?: { content?: { parts?: { text?: unknown }[] } }[];
      usageMetadata?: { thoughtsTokenCount?: unknown; candidatesTokenCount?: unknown; promptTokenCount?: unknown };
    };
    const parts = j.candidates?.[0]?.content?.parts ?? [];
    const content = parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
    // Thought tokens are billed as output, so they are counted as output rather
    // than discarded: that is the ground truth for whether `minimal` minimised
    // anything, and dropping it would understate the spend.
    const thoughts = typeof j.usageMetadata?.thoughtsTokenCount === "number" ? j.usageMetadata.thoughtsTokenCount : 0;
    const out = j.usageMetadata?.candidatesTokenCount;
    return {
      content,
      usage: usageFrom(j.usageMetadata?.promptTokenCount, typeof out === "number" ? out + thoughts : out),
    };
  },
};

// One round-trip. Returns content plus usage, the same shape `chatComplete`
// returns, which is the whole point of ticket 31.
export async function geminiComplete({ model, messages }: { model: string; messages: GeminiMessage[] }): Promise<ModelReply> {
  return await complete(gemini, { model, messages, reasoning: "none" });
}
