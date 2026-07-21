/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { geminiComplete, geminiTranslateModel } from "./geminiClient";

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

test("geminiComplete posts to the native generateContent endpoint with the key, system + user, thinking off", async () => {
  const { calls } = stubFetch(["bonjour"]);
  const out = await geminiComplete({
    model: "gemini-3.5-flash",
    messages: [
      { role: "system", content: "translate" },
      { role: "user", content: "hi" },
    ],
  });

  expect(out).toBe("bonjour");
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
  // The whole point of the native path: thinking genuinely off (not billed).
  expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
});

test("geminiComplete concatenates every text part of the first candidate", async () => {
  stubFetch(["hola ", "mundo"]);
  const out = await geminiComplete({ model: "m", messages: [{ role: "user", content: "hi" }] });
  expect(out).toBe("hola mundo");
});

test("geminiComplete retries once without thinkingConfig when the tier clamps a minimum thinking budget", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      if (bodies.length === 1)
        return new Response(
          JSON.stringify({ error: { message: "thinkingBudget must be at least 128 for this model", code: 400 } }),
          { status: 400 },
        );
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "traduit" }] } }] }), { status: 200 });
    }),
  );

  const out = await geminiComplete({ model: "gemini-x", messages: [{ role: "user", content: "hi" }] });
  expect(out).toBe("traduit");
  expect(bodies).toHaveLength(2);
  expect(JSON.parse(bodies[0]!).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  expect(JSON.parse(bodies[1]!).generationConfig?.thinkingConfig).toBeUndefined();
});

test("geminiComplete does not retry an unrelated 400", async () => {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ error: { message: "invalid argument: contents" } }), { status: 400 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await expect(geminiComplete({ model: "m", messages: [] })).rejects.toThrow(/400/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("geminiComplete throws on a non-OK response and when the key is missing", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 429 })));
  await expect(geminiComplete({ model: "m", messages: [] })).rejects.toThrow(/429/);

  delete process.env.GOOGLE_AI_API_KEY;
  await expect(geminiComplete({ model: "m", messages: [] })).rejects.toThrow(/GOOGLE_AI_API_KEY/);
});

test("the translate model comes from env with a gemini-3.5-flash default", () => {
  expect(geminiTranslateModel()).toBe("gemini-3.5-flash");
  process.env.GEMINI_TRANSLATE_MODEL = "gemini-2.5-flash-lite";
  expect(geminiTranslateModel()).toBe("gemini-2.5-flash-lite");
});
