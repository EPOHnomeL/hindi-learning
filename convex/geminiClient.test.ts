/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { geminiComplete, geminiTranslateModel } from "./geminiClient";

// Only what is vendor-specific about Gemini. The shared policy (missing key,
// post-once-retry-once, non-OK, empty completion, usage normalisation) moved to
// `modelCall.test.ts` with the policy itself on 2026-09-08 (ticket 31): these
// assertions and `openrouterClient.test.ts`'s were the same tests twice, because
// the code they covered was the same code twice.

// A captured fetch call, so we can assert on URL / headers / body.
type Captured = { url: string; init: RequestInit };
function stubFetch(parts: string[]): { calls: Captured[] } {
  const calls: Captured[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: parts.map((text) => ({ text })), role: "model" } }] }),
        { status: 200 },
      );
    }),
  );
  return { calls };
}

beforeEach(() => {
  process.env.GOOGLE_AI_API_KEY = "ai-studio-test";
  delete process.env.GEMINI_TRANSLATE_MODEL;
});
afterEach(() => vi.unstubAllGlobals());

test("geminiComplete posts to the native generateContent endpoint with the key, system + user, thinking minimal", async () => {
  const { calls } = stubFetch(["bonjour"]);
  const out = await geminiComplete({
    model: "gemini-3.5-flash",
    messages: [
      { role: "system", content: "translate" },
      { role: "user", content: "hi" },
    ],
  });

  expect(out.content).toBe("bonjour");
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
  );
  const headers = calls[0]!.init.headers as Record<string, string>;
  expect(headers["x-goog-api-key"]).toBe("ai-studio-test");
  const body = JSON.parse(calls[0]!.init.body as string);
  // System prompt rides in systemInstruction; the user turn in contents.
  expect(body.systemInstruction).toEqual({ parts: [{ text: "translate" }] });
  expect(body.contents).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
  // The whole point of the native path: thinking pinned to the floor. Gemini 3.x
  // has no "off" — `thinkingLevel: "minimal"` is the least reasoning payable.
  expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe("minimal");
});

test("geminiComplete concatenates every text part of the first candidate", async () => {
  stubFetch(["hola ", "mundo"]);
  const out = await geminiComplete({ model: "m", messages: [{ role: "user", content: "hi" }] });
  expect(out.content).toBe("hola mundo");
});

test("geminiComplete retries once without thinkingConfig when a model rejects the thinking control", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      if (bodies.length === 1)
        return new Response(
          JSON.stringify({ error: { message: "thinking_level is not supported for this model", code: 400 } }),
          { status: 400 },
        );
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "traduit" }] } }] }), { status: 200 });
    }),
  );

  const out = await geminiComplete({ model: "gemini-x", messages: [{ role: "user", content: "hi" }] });
  expect(out.content).toBe("traduit");
  expect(bodies).toHaveLength(2);
  expect(JSON.parse(bodies[0]!).generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  expect(JSON.parse(bodies[1]!).generationConfig?.thinkingConfig).toBeUndefined();
});

test("the translate model comes from env with a gemini-3.5-flash default", () => {
  expect(geminiTranslateModel()).toBe("gemini-3.5-flash");
  process.env.GEMINI_TRANSLATE_MODEL = "gemini-2.5-flash-lite";
  expect(geminiTranslateModel()).toBe("gemini-2.5-flash-lite");
});

test("thought tokens are counted as output, because that is how they are billed", () => {
  // The cost finding this client exists for: `minimal` minimises thinking rather
  // than switching it off, so a non-zero thought count is real spend. Dropping it
  // would report a translation run as cheaper than the invoice.
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "hola" }] } }],
            usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40, thoughtsTokenCount: 25 },
          }),
          { status: 200 },
        ),
    ),
  );
  return expect(geminiComplete({ model: "m", messages: [] })).resolves.toEqual({
    content: "hola",
    usage: { inputTokens: 100, outputTokens: 65 },
  });
});
