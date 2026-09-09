// @vitest-environment node
import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { refusalMessage, refusalTag } from "./mutationRun";

// Reading a server refusal on the client (ticket 32). This is the knowledge that
// had been re-learned from separate production incidents and copied into four
// files, and it had never been tested anywhere.
//
// **Only the pure half is tested, and that is a deliberate limit.**
// `vitest.config.ts` runs the edge-runtime environment and the repo has no
// `.test.tsx` at all (28 `.test.ts`, 0 `.test.tsx`, checked 2026-09-08).
// Exercising `useMutationRun` itself would mean adding a React testing
// dependency and a second environment, which is a bigger decision than this
// ticket. `refusalTag` and `refusalMessage` carry every fact the incidents
// taught, so they are what is pinned.

test("a tagged ConvexError's data survives the trip and is what we read", () => {
  // The whole reason this function exists. A production Convex deployment
  // redacts a plain Error's message before it reaches the client; only
  // ConvexError's `data` arrives intact.
  expect(refusalTag(new ConvexError("voucher/code-used"))).toBe("voucher/code-used");
  expect(refusalMessage(new ConvexError("access/code-full"), "fallback")).toBe("access/code-full");
});

test("a ConvexError carrying object data is not a tag, and does not become one", () => {
  // The two panels that map a tag onto localised copy switch on a string. An
  // object here must fall through to the generic message rather than be
  // stringified into the UI as "[object Object]".
  expect(refusalTag(new ConvexError({ code: "nope" }))).toBe("");
  expect(refusalMessage(new ConvexError({ code: "nope" }), "fallback")).toBe("fallback");
});

test("the redacted production Error is never shown to a user", () => {
  // This exact string is what an Editor saw in place of every one of the write
  // path's carefully worded refusals until 2026-08-05.
  const redacted = new Error("[CONVEX A(translate:publishTranslation)] [Request ID: abc] Server Error");
  expect(refusalTag(redacted)).toBe("");
  expect(refusalMessage(redacted, "fallback")).toBe("fallback");
  // And the mutation-shaped one, which is what the donation-flag precondition
  // looked like the first time it fired in prod.
  expect(refusalMessage(new Error("[CONVEX M(tenantFlags:setTenantFlags)] Server Error"), "fallback")).toBe("fallback");
});

test("a genuinely local failure keeps its own already-localised message", () => {
  // The branch `ArtifactView`'s copy had and `AdminPanel`'s did not: the upload
  // PUT throws locally, and replacing that with a generic fallback loses real
  // information about what went wrong.
  expect(refusalMessage(new Error("Upload failed: 413"), "fallback")).toBe("Upload failed: 413");
});

test("a non-Error throw falls back rather than crashing the handler", () => {
  for (const thrown of [undefined, null, "a bare string", 42, { message: "not an Error" }]) {
    expect(refusalTag(thrown)).toBe("");
    expect(refusalMessage(thrown, "fallback")).toBe("fallback");
  }
});

test("an Error with an empty message falls back rather than showing nothing", () => {
  // A control that renders `error &&` would show no message at all, which reads
  // as success.
  expect(refusalMessage(new Error(""), "fallback")).toBe("fallback");
});

test("no control swallows a refusal with a finally and no catch", () => {
  // The nine sites that did. `.finally(() => setBusy(false))` on a mutation
  // promise, with no `.catch` and no `try`, is the exact shape: the server wrote
  // a carefully worded refusal and the user saw nothing.
  //
  // Two more than the seven the 2026-09-04 review counted. It missed
  // `SharingTab`'s publish and public-link toggles, which have the same shape.
  const files = import.meta.glob("../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const silent = /\.finally\(\(\) => set[A-Za-z]*[Bb]usy\(/g;
  const offenders = Object.entries(files)
    .filter(([p]) => !p.includes(".test."))
    .filter(([, s]) =>
      [...s.matchAll(silent)].some((m) => {
        // A chain that DOES handle the refusal is fine. Look back over the
        // statement for a `.catch(`, which is what `VoucherCard`'s raise-cap
        // form has and what the offenders did not.
        const statement = s.slice(Math.max(0, m.index - 400), m.index);
        return !statement.includes(".catch(");
      }),
    )
    .map(([p]) => p);
  expect(offenders).toEqual([]);
});
