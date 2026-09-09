// A thin, env-configured wrapper over OpenRouter's OpenAI-compatible
// chat-completions endpoint (ADR 0014). Shared by every OpenRouter action
// (authoring + translation). Deliberately dependency-free — a single `fetch`
// seam, so a test mocks the HTTP boundary with `vi.stubGlobal("fetch", ...)`
// and downstream action tests control the "model output" the same way. One
// operator key + env-default model slugs; no per-user keys, no SDK.
//
// Live smoke (real endpoint): the build/test env has no key (tests mock `fetch`).
// To smoke-test for real, set `OPENROUTER_API_KEY` on the Convex dev deployment
// (`npx convex env set OPENROUTER_API_KEY sk-...`) and fire an OpenRouter course
// (issue 03's `openrouter:authorTopic`); `npx convex logs` shows the round-trip,
// and the first authored lesson is proof the client reached the model.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Model slugs are env-overridable with the spike's defaults. GLM 4.2 (the PRD's
// name) has no OpenRouter slug — the z-ai line runs 4.5 → 4.6 → 4.7 → 5.3 —
// so the authoring default is the current GLM flagship `z-ai/glm-5.3-flash`.
// Translation defaults to `google/gemini-3.5-flash`. Both confirmed on OpenRouter (issue 02).
export const authorModel = (): string => process.env.OPENROUTER_AUTHOR_MODEL ?? "z-ai/glm-5.3-flash";
export const translateModel = (): string => process.env.OPENROUTER_TRANSLATE_MODEL ?? "google/gemini-3.5-flash";

// The shared policy (key, post-once-retry-once, errors, usage) lives in
// `convex/modelCall.ts` since 2026-09-08 (ticket 31). What is left here is the
// OpenRouter wire format: this endpoint, this auth header, `reasoning.effort` as
// the thinking control, and where OpenRouter puts content and token counts.
import { complete, usageFrom, type ChatMessage, type ModelAdapter, type ModelReply, type ModelRequest } from "./modelCall";

export type { ChatMessage, ModelUsage as ChatUsage } from "./modelCall";
export type ChatOptions = ModelRequest;

const openrouter: ModelAdapter = {
  vendor: "openrouter",
  keyEnv: "OPENROUTER_API_KEY",
  request(key, req, dropReasoning) {
    const body: Record<string, unknown> = { model: req.model, messages: req.messages };
    if (req.webSearch) body.plugins = [{ id: "web" }];
    // OpenRouter's unified reasoning control. NOTE it is silently ignored for
    // Gemini endpoints, which is why `geminiClient.ts` exists at all.
    if (req.reasoning && !dropReasoning) body.reasoning = { effort: req.reasoning };
    return {
      url: ENDPOINT,
      init: {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      },
    };
  },
  sendsReasoningControl: (req) => req.reasoning !== undefined,
  isReasoningComplaint: (body) => /reasoning/i.test(body),
  parse(json): ModelReply {
    const j = json as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };
    const content = j.choices?.[0]?.message?.content;
    // A non-string content is not an empty completion, it is a shape this client
    // does not understand, and it gets its own error rather than the shared one.
    if (typeof content !== "string") throw new Error("openrouter: no message content in response");
    return { content, usage: usageFrom(j.usage?.prompt_tokens, j.usage?.completion_tokens) };
  },
};

// One round-trip: send the messages, return the assistant's text content plus
// whatever usage the provider reported alongside it.
export async function chatComplete(options: ChatOptions): Promise<ModelReply> {
  return await complete(openrouter, options);
}
