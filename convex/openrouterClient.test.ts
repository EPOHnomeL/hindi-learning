/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { authorModel, chatComplete, translateModel } from "./openrouterClient";

// Only what is vendor-specific about OpenRouter. The shared policy (missing key,
// post-once-retry-once, non-OK, empty completion, usage normalisation) moved to
// `modelCall.test.ts` with the policy itself on 2026-09-08 (ticket 31).

// A captured fetch call, so we can assert on URL / headers / body.
type Captured = { url: string; init: RequestInit };
function stubFetch(content: string): { calls: Captured[] } {
  const calls: Captured[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    }),
  );
  return { calls };
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "sk-test";
  delete process.env.OPENROUTER_AUTHOR_MODEL;
  delete process.env.OPENROUTER_TRANSLATE_MODEL;
});
afterEach(() => vi.unstubAllGlobals());

test("chatComplete posts to OpenRouter with auth + model, returns the message content", async () => {
  const { calls } = stubFetch("hello world");
  const out = await chatComplete({ model: "z-ai/glm-4.7", messages: [{ role: "user", content: "hi" }] });

  expect(out.content).toBe("hello world");
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
  const headers = calls[0]!.init.headers as Record<string, string>;
  expect(headers.authorization).toBe("Bearer sk-test");
  const body = JSON.parse(calls[0]!.init.body as string);
  expect(body.model).toBe("z-ai/glm-4.7");
  expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  expect(body.plugins).toBeUndefined(); // no web search unless asked
});

test("chatComplete enables the OpenRouter web plugin when webSearch is set", async () => {
  const { calls } = stubFetch("x");
  await chatComplete({ model: "m", messages: [{ role: "user", content: "q" }], webSearch: true });
  const body = JSON.parse(calls[0]!.init.body as string);
  expect(body.plugins).toEqual([{ id: "web" }]);
});

test("chatComplete retries once without reasoning when the endpoint mandates it", async () => {
  // Real prod failure: gemini-3.5-flash's endpoint 400s on reasoning "none".
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      if (bodies.length === 1)
        return new Response(
          JSON.stringify({ error: { message: "Reasoning is mandatory for this endpoint and cannot be disabled.", code: 400 } }),
          { status: 400 },
        );
      return new Response(JSON.stringify({ choices: [{ message: { content: "traduit" } }] }), { status: 200 });
    }),
  );

  const out = await chatComplete({ model: "google/gemini-3.5-flash", messages: [{ role: "user", content: "hi" }], reasoning: "none" });
  expect(out.content).toBe("traduit");
  expect(bodies).toHaveLength(2);
  expect(JSON.parse(bodies[0]!).reasoning).toEqual({ effort: "none" });
  expect(JSON.parse(bodies[1]!).reasoning).toBeUndefined();
});

test("model slugs come from env with GLM/Gemini defaults", () => {
  expect(authorModel()).toBe("z-ai/glm-5.3-flash");
  expect(translateModel()).toBe("google/gemini-3.5-flash");
  process.env.OPENROUTER_AUTHOR_MODEL = "custom/author";
  process.env.OPENROUTER_TRANSLATE_MODEL = "custom/translate";
  expect(authorModel()).toBe("custom/author");
  expect(translateModel()).toBe("custom/translate");
});
