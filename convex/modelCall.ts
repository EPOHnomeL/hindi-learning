// **One model call, two adapters.** The shared policy for talking to a model
// provider, with each vendor reduced to its wire format.
//
// Until 2026-09-08 the two clients had different interfaces for the same job:
// `chatComplete` returned `{ content, usage }` and `geminiComplete` returned a
// bare string. With no shared seam, one policy was written twice, and
// `geminiClient.ts`'s own comment admitted it "mirrors openrouterClient": the
// missing-key error, the post-once-retry-once dance around the reasoning
// opt-out, the non-OK error, the empty-content error and the usage read all
// appeared in both files, and their tests mirrored the duplication too
// (candidate 7 of the 2026-09-04 architecture review, ticket 31).
//
// **The policy IS genuinely identical, which the ticket told us to check rather
// than assume.** Read side by side, both clients do exactly this: require a key,
// build the request, post, and if the answer is a 400 whose body complains about
// the reasoning control, drop that control and post once more. Then refuse a
// non-OK response, refuse an empty completion, and normalise whatever usage the
// provider reported. Every difference between them is a wire-format difference:
// the endpoint and headers, WHICH control gets dropped (`reasoning.effort`
// against `thinkingConfig`), what a reasoning complaint looks like in that
// vendor's prose, and where content and token counts sit in the response. So the
// differences live in the adapters, named, rather than being flattened.
//
// This honours ADR 0014 rather than reopening it. The ADR rejects bespoke
// per-vendor SDK integrations; two vendors behind one interface is the shape it
// asks for. The native Gemini client stays, because deleting it would contradict
// the cost finding that created it (thinking cannot be disabled through
// OpenRouter's unified control for Gemini endpoints), not the ADR.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// What the provider says the call cost, in tokens (cost instrumentation, ticket
// 12). `undefined` when the response carried no usable usage object: that is
// UNKNOWN, never zero, and a caller recording it must keep the distinction.
// Counts only, no price: pricing is out of scope here and lives nowhere in this
// repo.
export type ModelUsage = { inputTokens: number; outputTokens: number };

export type ModelReply = { content: string; usage: ModelUsage | undefined };

// What a caller asks for. `reasoning: "none"` asks the vendor to switch thinking
// off, which is worth asking for because thinking is billed as output tokens and
// buys nothing for constrained translation. Whether the vendor honours it is the
// adapter's business, and the reason there are two adapters at all.
export type ModelRequest = {
  model: string;
  messages: ChatMessage[];
  webSearch?: boolean;
  reasoning?: "none";
};

// A vendor, reduced to what is actually vendor-specific.
export type ModelAdapter = {
  // Named in every error, so a failure says which rail broke.
  vendor: string;
  // The env var holding the operator key. One key per vendor, no per-user keys.
  keyEnv: string;
  // The HTTP call, built from the request. `dropReasoning` is set on the retry.
  request(key: string, req: ModelRequest, dropReasoning: boolean): { url: string; init: RequestInit };
  // Is there a reasoning control in this request to drop? False means no retry
  // is possible and a 400 is just a 400.
  sendsReasoningControl(req: ModelRequest): boolean;
  // Does this 400 body complain about that control? Each vendor words it its own
  // way, so each vendor owns the pattern.
  isReasoningComplaint(body: string): boolean;
  // Pull the completion and the token counts out of this vendor's response shape.
  parse(json: unknown): ModelReply;
};

// One round-trip, with the one retry. Throws on a missing key, a non-OK response
// or an empty completion, so a caller can report `failed`.
export async function complete(adapter: ModelAdapter, req: ModelRequest): Promise<ModelReply> {
  const key = process.env[adapter.keyEnv];
  if (!key) throw new Error(`${adapter.keyEnv} not set`);

  const post = (dropReasoning: boolean) => {
    const { url, init } = adapter.request(key, req, dropReasoning);
    return fetch(url, init);
  };

  let res = await post(false);
  // Some endpoints mandate reasoning and 400 the opt-out ("Reasoning is
  // mandatory for this endpoint and cannot be disabled" on OpenRouter; a 2.5-era
  // Gemini tier rejecting `thinkingLevel`). Retry once with the model's default
  // rather than fail every call of a run. A 400 that says nothing about
  // reasoning is a real 400 and is not retried.
  if (res.status === 400 && adapter.sendsReasoningControl(req)) {
    const text = await res.text();
    if (!adapter.isReasoningComplaint(text)) throw new Error(`${adapter.vendor} 400: ${text}`);
    res = await post(true);
  }
  if (!res.ok) throw new Error(`${adapter.vendor} ${res.status}: ${await res.text()}`);

  const reply = adapter.parse(await res.json());
  if (reply.content === "") throw new Error(`${adapter.vendor}: no message content in response`);
  // One usage log for both rails. The native Gemini client used to log its counts
  // and the OpenRouter client logged nothing, so `npx convex logs` could answer
  // the cost question on one rail and not the other. Absent usage is reported as
  // unknown rather than as zero, matching ticket 12's convention.
  console.log(
    `${adapter.vendor} usage: model=${req.model} ` +
      (reply.usage ? `in=${reply.usage.inputTokens} out=${reply.usage.outputTokens}` : "unknown"),
  );
  return reply;
}

// Both adapters read numbers out of an untyped JSON body, so the "only count it
// if both halves are real numbers" rule is stated once. A provider reporting one
// half is reporting nothing usable.
export function usageFrom(inputTokens: unknown, outputTokens: unknown): ModelUsage | undefined {
  return typeof inputTokens === "number" && typeof outputTokens === "number" ? { inputTokens, outputTokens } : undefined;
}
