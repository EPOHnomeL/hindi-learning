// A thin, env-configured wrapper over Google's native Gemini Developer API
// (AI Studio key) `generateContent` endpoint. Sibling of `openrouterClient.ts`,
// same dependency-free `fetch` seam (tests stub fetch), one operator key, no SDK,
// no per-user keys — the app-LLM-free stance holds (ADR 0014).
//
// Why a second client at all: OpenRouter's unified `reasoning: { effort: "none" }`
// is silently ignored for Gemini endpoints — the opt-out 400s and the OpenRouter
// client retries with thinking back ON, so every translation still bills thinking
// tokens as output (translation-cost 05). The native API honours
// `thinkingConfig.thinkingBudget: 0`, so on this path thinking is genuinely off.
// Used ONLY by the translate path; authoring stays on OpenRouter/GLM.
//
// Live smoke: the test env has no key (tests mock `fetch`). To smoke-test for real,
// set `GOOGLE_AI_API_KEY` on the Convex deployment (`npx convex env set GOOGLE_AI_API_KEY …`)
// and fire a translation; `npx convex logs` shows the round-trip.

const endpoint = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Env-overridable, defaulting to the same model the OpenRouter path ran — now on
// the native API with thinking disabled. Swap via `GEMINI_TRANSLATE_MODEL` for a
// cheaper tier (e.g. `gemini-2.5-flash-lite`) without a code change.
export const geminiTranslateModel = (): string => process.env.GEMINI_TRANSLATE_MODEL ?? "gemini-3.5-flash";

// Structurally identical to openrouterClient's ChatMessage, so a caller can pass
// the same message array to either client; kept local so this module has no
// dependency on the OpenRouter client.
export type GeminiMessage = { role: "system" | "user" | "assistant"; content: string };

// One round-trip: map our [system?, user] messages onto Gemini's
// systemInstruction + contents, disable thinking, and return the assistant text.
// Throws on a missing key or a non-OK response so the caller can report `failed`.
export async function geminiComplete({ model, messages }: { model: string; messages: GeminiMessage[] }): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set");

  // Gemini splits the system prompt out of the turn list into `systemInstruction`.
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const post = () =>
    fetch(endpoint(model), {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });

  let res = await post();
  // Some tiers clamp a minimum thinking budget and 400 the `thinkingBudget: 0`
  // opt-out; retry once with the model's default thinking rather than fail every
  // call of the run (mirrors openrouterClient's reasoning-mandatory retry).
  if (res.status === 400) {
    const text = await res.text();
    if (!/think/i.test(text)) throw new Error(`gemini 400: ${text}`);
    delete (body.generationConfig as Record<string, unknown>).thinkingConfig;
    res = await post();
  }
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("");
  if (text === "") throw new Error("gemini: no text content in response");
  return text;
}
