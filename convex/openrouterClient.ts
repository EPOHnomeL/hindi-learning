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
// name) has no OpenRouter slug — the z-ai line runs 4.5 → 4.6 → 4.7 — so the
// authoring default is the current GLM flagship `z-ai/glm-4.7`. Translation
// defaults to `google/gemini-3.5-flash`. Both confirmed on OpenRouter (issue 02).
export const authorModel = (): string => process.env.OPENROUTER_AUTHOR_MODEL ?? "z-ai/glm-4.7";
export const translateModel = (): string => process.env.OPENROUTER_TRANSLATE_MODEL ?? "google/gemini-3.5-flash";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  // Enable OpenRouter's `web` plugin for this call (web-grounded generation).
  webSearch?: boolean;
  temperature?: number;
};

// One round-trip: send the messages, return the assistant's text content.
// Throws on a missing key or a non-OK response so the caller can report `failed`.
export async function chatComplete({ model, messages, webSearch, temperature }: ChatOptions): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const body: Record<string, unknown> = { model, messages };
  if (webSearch) body.plugins = [{ id: "web" }];
  if (temperature !== undefined) body.temperature = temperature;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("openrouter: no message content in response");
  return content;
}
