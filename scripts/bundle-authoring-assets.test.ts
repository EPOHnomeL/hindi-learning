// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { OUTPUT, bundleAuthoringAssets, renderAssetsModule } from "./bundle-authoring-assets";
import { LESSON_FOOT, LESSON_HEAD, REFERENCE_HEAD, TEACH_INSTRUCTIONS } from "../convex/authoringAssets.generated";

test("renderAssetsModule is deterministic and embeds every source verbatim", () => {
  const docs = [
    { rel: "a.md", content: "Alpha instructions\n" },
    { rel: "b.md", content: "Beta ` ${danger} ` instructions" },
  ];
  const head = "<style>.x{}</style>\n";
  const foot = "<script>1</script>\n";
  const refHead = "<style>.term{}</style>\n";

  const once = renderAssetsModule(docs, head, foot, refHead);
  const twice = renderAssetsModule(docs, head, foot, refHead);
  expect(once).toBe(twice); // deterministic — no timestamps, fixed order

  // Every source appears verbatim (backticks/${} survive via JSON.stringify).
  expect(once).toContain("Alpha instructions");
  expect(once).toContain("Beta ` ${danger} ` instructions");
  expect(once).toContain("<style>.x{}</style>");
  expect(once).toContain("<script>1</script>");
  expect(once).toContain("<style>.term{}</style>");
});

test("the committed bundle is what the bundler produces from today's sources", () => {
  // Runs the real bundler, which is the part that was never exercised: between
  // 2026-08-27 and 2026-09-08 the suite tested only `renderAssetsModule` against
  // fixtures, so it stayed green for eleven days while `pnpm bundle:authoring`
  // could not start at all (the skills CLI had deleted a source out from under it).
  //
  // One assertion covers both failure modes. A missing source throws out of
  // `readSource`; a stale generated file mismatches. Fix either by running
  // `pnpm bundle:authoring`.
  expect(bundleAuthoringAssets()).toBe(readFileSync(OUTPUT, "utf8"));
});

test("a source the skills CLI has deleted is named, not swallowed", () => {
  // Proves the guard above can fail, and fail legibly. The bare ENOENT this
  // replaces said `open '<absolute path>'` and nothing about which list wanted it.
  expect(() => bundleAuthoringAssets([".agents/skills/teach/GONE-UPSTREAM.md"])).toThrow(
    /cannot read the authoring source ".agents\/skills\/teach\/GONE-UPSTREAM.md"/,
  );
});

test("the generated module mirrors the current partials verbatim", () => {
  // The exported shape the OpenRouter action actually imports, checked directly
  // rather than through the rendered text.
  expect(LESSON_HEAD).toBe(readFileSync("lessons/_partials/head.html", "utf8").trim());
  expect(LESSON_FOOT).toBe(readFileSync("lessons/_partials/foot.html", "utf8").trim());
  expect(REFERENCE_HEAD).toBe(readFileSync("lessons/_partials/reference-head.html", "utf8").trim());
  expect(TEACH_INSTRUCTIONS).toContain("# === lessons/AUTHORING.md ===");
});
