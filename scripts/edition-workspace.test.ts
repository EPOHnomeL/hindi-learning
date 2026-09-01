// @vitest-environment node
import { expect, test } from "vitest";
import { fileFor, planPush, titleFrom, type Item, type Manifest } from "./edition-workspace";

const item = (over: Partial<Item> & Pick<Item, "kind" | "key">): Item => ({
  title: "Stored title",
  file: fileFor(over.kind, over.key),
  blobBacked: false,
  ...over,
});

const manifestOf = (items: Item[]): Manifest => ({
  topicSlug: "prophetic-school",
  lang: "st-ZA",
  deployment: "prod",
  ownerEmail: "owner@example.com",
  pulledAt: "2026-09-01T00:00:00.000Z",
  items,
});

/** A `read` backed by a plain object of tree-prefixed path to contents. */
const reader = (files: Record<string, string>) => (path: string) => files[path] ?? null;

const lesson = (heading: string, correct = 2) =>
  `<!doctype html><html lang="st"><head><title>Brand · ${heading}</title></head>` +
  `<body><h1>${heading}</h1>` +
  `<div class="quiz" data-correct="${correct}" data-k="q1" data-ok="Right"><p>Prose</p></div>` +
  `</body></html>`;

test("fileFor mirrors the publish-translation layout", () => {
  expect(fileFor("lesson", "0001-listening")).toBe("lessons/0001-listening.html");
  expect(fileFor("reference", "glossary")).toBe("references/glossary.html");
  expect(fileFor("title", "")).toBe("title.txt");
  expect(fileFor("mission", "")).toBe("mission.txt");
});

test("fileFor refuses a key that would escape the workspace", () => {
  // A key reaches the filesystem as a path segment. Rejected rather than sanitised:
  // a silently renamed key would push its body back to the wrong row.
  expect(() => fileFor("lesson", "../../etc/passwd")).toThrow(/unusable key/);
  expect(() => fileFor("lesson", "nested/key")).toThrow(/unusable key/);
  expect(() => fileFor("lesson", "")).toThrow(/unusable key/);
  expect(() => fileFor("question", "abc")).toThrow(/no workspace file/);
});

test("titleFrom takes the document title and drops the brand prefix", () => {
  expect(titleFrom("<title>Brand · Real Title</title>")).toBe("Real Title");
  expect(titleFrom("<title>Real Title</title>")).toBe("Real Title");
  expect(titleFrom("<p>no title element</p>")).toBe("");
});

test("an untouched item is not sent, and --all sends it anyway", () => {
  const it = item({ kind: "lesson", key: "0001" });
  const files = {
    "pristine/lessons/0001.html": lesson("One"),
    "working/lessons/0001.html": lesson("One"),
  };
  const quiet = planPush(manifestOf([it]), reader(files));
  expect(quiet.send).toHaveLength(0);
  expect(quiet.unchanged).toHaveLength(1);
  expect(quiet.problems).toHaveLength(0);

  const forced = planPush(manifestOf([it]), reader(files), { all: true });
  expect(forced.send).toHaveLength(1);
  expect(forced.send[0]!.reason).toBe("forced");
});

test("an edited lesson is sent, with its title re-derived from the edited document", () => {
  const plan = planPush(
    manifestOf([item({ kind: "lesson", key: "0001" })]),
    reader({
      "pristine/lessons/0001.html": lesson("Learning to Listen"),
      "working/lessons/0001.html": lesson("Ho Ithuta ho Mamela"),
    }),
  );
  expect(plan.problems).toHaveLength(0);
  expect(plan.send).toHaveLength(1);
  expect(plan.send[0]!.reason).toBe("edited");
  const body = plan.send[0]!.body;
  expect("html" in body && body.title).toBe("Ho Ithuta ho Mamela");
});

test("a blob-backed row is sent even when nothing changed", () => {
  // It may still be sharing its _storage object with the Edition it was cloned from,
  // so republishing (which writes inline and clears htmlStorageId) is what makes the
  // row this Edition's own. Skipping it is how an "edit" silently never lands.
  const plan = planPush(
    manifestOf([item({ kind: "lesson", key: "0001", blobBacked: true })]),
    reader({
      "pristine/lessons/0001.html": lesson("One"),
      "working/lessons/0001.html": lesson("One"),
    }),
  );
  expect(plan.unchanged).toHaveLength(0);
  expect(plan.send).toHaveLength(1);
  expect(plan.send[0]!.reason).toBe("blob-backed");
});

test("quiz-marker drift is refused locally rather than skipped server-side", () => {
  const plan = planPush(
    manifestOf([item({ kind: "lesson", key: "0001" })]),
    reader({
      "pristine/lessons/0001.html": lesson("One"),
      // The edit dropped the data-k attribute along with the prose it rewrote.
      "working/lessons/0001.html": lesson("One").replace(' data-k="q1"', ""),
    }),
  );
  expect(plan.send).toHaveLength(0);
  expect(plan.problems.map((p) => p.problem)).toEqual(["quiz-drift"]);
});

test("a surviving static-block placeholder is refused", () => {
  const plan = planPush(
    manifestOf([item({ kind: "lesson", key: "0001" })]),
    reader({
      "pristine/lessons/0001.html": lesson("One"),
      "working/lessons/0001.html": lesson("One").replace("<p>Prose</p>", "<!--⟦0⟧-->"),
    }),
  );
  expect(plan.problems.map((p) => p.problem)).toEqual(["placeholder"]);
});

test("a document with no title anywhere is refused, because publish would clear it", () => {
  const it = item({ kind: "reference", key: "glossary", title: undefined });
  const plan = planPush(
    manifestOf([it]),
    reader({
      "pristine/references/glossary.html": "<p>before</p>",
      "working/references/glossary.html": "<p>after</p>",
    }),
  );
  expect(plan.problems.map((p) => p.problem)).toEqual(["no-title"]);
});

test("a blanked title or mission is refused, since blank reverts the row to English", () => {
  const plan = planPush(
    manifestOf([item({ kind: "title", key: "" }), item({ kind: "mission", key: "" })]),
    reader({
      "pristine/title.txt": "Sekolo sa Boporofeta",
      "working/title.txt": "   \n",
      "pristine/mission.txt": "The mission",
      "working/mission.txt": "Boikemisetso",
    }),
  );
  expect(plan.problems.map((p) => p.problem)).toEqual(["empty"]);
  expect(plan.send).toHaveLength(1);
  expect(plan.send[0]!.body).toEqual({ text: "Boikemisetso" });
});

test("a missing file is a problem, not a deletion", () => {
  const plan = planPush(
    manifestOf([item({ kind: "lesson", key: "0001" }), item({ kind: "lesson", key: "0002" })]),
    reader({
      // 0001 lost its working copy; 0002 lost its comparison basis.
      "pristine/lessons/0001.html": lesson("One"),
      "working/lessons/0002.html": lesson("Two"),
    }),
  );
  expect(plan.send).toHaveLength(0);
  expect(plan.problems.map((p) => p.problem)).toEqual(["missing", "missing-pristine"]);
});

test("a question row is never pushed", () => {
  const plan = planPush(
    manifestOf([{ kind: "question", key: "q1", file: "questions/q1.txt", blobBacked: false }]),
    reader({ "pristine/questions/q1.txt": "a", "working/questions/q1.txt": "b" }),
  );
  expect(plan.send).toHaveLength(0);
  expect(plan.problems.map((p) => p.problem)).toEqual(["unsupported"]);
});
