// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { renderAssetsModule } from "./bundle-authoring-assets";
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

test("the generated module mirrors the current teach skill + partials verbatim", () => {
  // Fails if the sources changed but the bundle wasn't regenerated — run
  // `pnpm bundle:authoring`. This is the no-drift guard the PRD asks for.
  const skill = readFileSync(".agents/skills/teach/SKILL.md", "utf8").trim();
  const head = readFileSync("lessons/_partials/head.html", "utf8").trim();
  const foot = readFileSync("lessons/_partials/foot.html", "utf8").trim();

  const skillAnchor = skill.split("\n").find((l) => l.trim().length > 20)!;
  expect(TEACH_INSTRUCTIONS).toContain(skillAnchor);
  expect(TEACH_INSTRUCTIONS).toContain("# === .agents/skills/teach/AUTHORING.md ===");
  expect(LESSON_HEAD).toBe(head);
  expect(LESSON_FOOT).toBe(foot);
  expect(REFERENCE_HEAD).toBe(readFileSync("lessons/_partials/reference-head.html", "utf8").trim());
});
