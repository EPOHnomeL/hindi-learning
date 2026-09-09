/// <reference types="vite/client" />
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { complete, usageFrom, type ModelAdapter } from "./modelCall";

// The shared model-call policy (ticket 31). These assertions used to exist twice,
// once in `openrouterClient.test.ts` and once in `geminiClient.test.ts`, because
// the policy itself existed twice. They are exercised here through a stub adapter
// so the policy is tested once and each vendor's own test file keeps only what is
// genuinely vendor-specific: its endpoint, its headers, its request shape and
// which thinking control it drops on the retry.

const KEY_ENV = "MODELCALL_TEST_KEY";

// A minimal vendor: one URL, a body that just echoes the request, and a response
// shape of its own. `sendsControl` is settable so the "nothing to drop, so no
// retry" branch can be driven.
function stubAdapter(overrides: Partial<ModelAdapter> = {}): ModelAdapter {
  return {
    vendor: "stubvendor",
    keyEnv: KEY_ENV,
    request: (key, req, dropReasoning) => ({
      url: "https://stub.example/complete",
      init: {
        method: "POST",
        headers: { authorization: key },
        body: JSON.stringify({ model: req.model, control: dropReasoning ? undefined : req.reasoning }),
      },
    }),
    sendsReasoningControl: (req) => req.reasoning !== undefined,
    isReasoningComplaint: (body) => /thinky/i.test(body),
    parse: (json) => {
      const j = json as { text?: string; in?: unknown; out?: unknown };
      return { content: j.text ?? "", usage: usageFrom(j.in, j.out) };
    },
    ...overrides,
  };
}

beforeEach(() => {
  process.env[KEY_ENV] = "stub-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env[KEY_ENV];
});

test("a missing key is refused before any request is made", async () => {
  delete process.env[KEY_ENV];
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(complete(stubAdapter(), { model: "m", messages: [] })).rejects.toThrow(KEY_ENV);
  // Not merely refused: refused without spending a call.
  expect(fetchMock).not.toHaveBeenCalled();
});

test("the key reaches the adapter, which decides where to put it", async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(JSON.stringify({ text: "ok" }), { status: 200 });
    }),
  );
  await complete(stubAdapter(), { model: "m", messages: [] });
  expect((calls[0]!.headers as Record<string, string>).authorization).toBe("stub-key");
});

test("a 400 complaining about the thinking control retries once with the control dropped", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      if (bodies.length === 1) return new Response("thinky is not supported here", { status: 400 });
      return new Response(JSON.stringify({ text: "second time lucky" }), { status: 200 });
    }),
  );

  const out = await complete(stubAdapter(), { model: "m", messages: [], reasoning: "none" });
  expect(out.content).toBe("second time lucky");
  expect(bodies).toHaveLength(2);
  expect(JSON.parse(bodies[0]!).control).toBe("none");
  expect(JSON.parse(bodies[1]!).control).toBeUndefined();
});

test("a 400 about something else is a real 400 and is not retried", async () => {
  const fetchMock = vi.fn(async () => new Response("malformed contents", { status: 400 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(complete(stubAdapter(), { model: "m", messages: [], reasoning: "none" })).rejects.toThrow(
    /stubvendor 400: malformed contents/,
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a 400 is not retried when there was no control to drop in the first place", async () => {
  // Even when the body DOES look like a thinking complaint. Retrying an identical
  // request is a wasted call, and this is the branch OpenRouter needs (it only
  // sends the control when a caller asks for it) but Gemini does not.
  const fetchMock = vi.fn(async () => new Response("thinky is mandatory", { status: 400 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(complete(stubAdapter(), { model: "m", messages: [] })).rejects.toThrow(/400/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a non-OK response names the vendor and carries the body", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
  await expect(complete(stubAdapter(), { model: "m", messages: [] })).rejects.toThrow(/stubvendor 429: rate limited/);
});

test("an empty completion is refused, so a caller never publishes nothing", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ text: "" }), { status: 200 })));
  await expect(complete(stubAdapter(), { model: "m", messages: [] })).rejects.toThrow(
    /stubvendor: no message content/,
  );
});

test("usage is normalised, and half-reported usage is unknown rather than zero", async () => {
  // Ticket 12's convention: absent means UNKNOWN and never zero, because a zero
  // would be summed into a total that then reads as measured.
  expect(usageFrom(812, 91)).toEqual({ inputTokens: 812, outputTokens: 91 });
  expect(usageFrom(812, undefined)).toBeUndefined();
  expect(usageFrom(undefined, 91)).toBeUndefined();
  expect(usageFrom("812", "91")).toBeUndefined();

  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ text: "hi", in: 5, out: 7 }), { status: 200 })));
  expect(await complete(stubAdapter(), { model: "m", messages: [] })).toEqual({
    content: "hi",
    usage: { inputTokens: 5, outputTokens: 7 },
  });
});

test("both rails log their usage the same way, including when it is unknown", async () => {
  // The asymmetry ticket 31 names: the Gemini client logged its counts and the
  // OpenRouter client logged nothing, so `npx convex logs` answered the cost
  // question on one rail and not the other.
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ text: "hi", in: 5, out: 7 }), { status: 200 })));
  await complete(stubAdapter(), { model: "some/model", messages: [] });
  expect(log).toHaveBeenCalledWith("stubvendor usage: model=some/model in=5 out=7");

  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ text: "hi" }), { status: 200 })));
  await complete(stubAdapter(), { model: "some/model", messages: [] });
  expect(log).toHaveBeenCalledWith("stubvendor usage: model=some/model unknown");
  log.mockRestore();
});
