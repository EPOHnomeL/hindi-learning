import { describe, expect, it } from "vitest";
import { planPublish } from "./plan.js";

describe("planPublish", () => {
  it("plans nothing for an empty workspace", () => {
    expect(planPublish([], []).actions).toEqual([]);
  });

  it("is idempotent: re-publishing an unchanged workspace plans nothing", () => {
    const workspace = [
      { kind: "lesson" as const, id: "0001-greetings", contentHash: "h1" },
      { kind: "reference" as const, id: "verb-conjugation", contentHash: "r1" },
    ];
    const published = [
      { kind: "lesson" as const, id: "0001-greetings", contentHash: "h1" },
      { kind: "reference" as const, id: "verb-conjugation", contentHash: "r1" },
    ];

    expect(planPublish(workspace, published).actions).toEqual([]);
  });

  it("plans a blob put and a metadata insert for a new Lesson", () => {
    const plan = planPublish(
      [{ kind: "lesson", id: "0001-greetings", contentHash: "h1" }],
      [],
    );

    expect(plan.actions).toEqual([
      { type: "put-blob", kind: "lesson", id: "0001-greetings" },
      { type: "insert-lesson", id: "0001-greetings" },
    ]);
  });

  it("does nothing for a Lesson already in the hub, even if its content changed (immutable)", () => {
    const plan = planPublish(
      [{ kind: "lesson", id: "0001-greetings", contentHash: "h2" }],
      [{ kind: "lesson", id: "0001-greetings", contentHash: "h1" }],
    );

    expect(plan.actions).toEqual([]);
  });

  it("plans a blob put and an upsert for a new Reference", () => {
    const plan = planPublish(
      [{ kind: "reference", id: "verb-conjugation", contentHash: "r1" }],
      [],
    );

    expect(plan.actions).toEqual([
      { type: "put-blob", kind: "reference", id: "verb-conjugation" },
      { type: "upsert-reference", id: "verb-conjugation" },
    ]);
  });

  it("does nothing for a Reference whose content is unchanged", () => {
    const plan = planPublish(
      [{ kind: "reference", id: "verb-conjugation", contentHash: "r1" }],
      [{ kind: "reference", id: "verb-conjugation", contentHash: "r1" }],
    );

    expect(plan.actions).toEqual([]);
  });

  it("re-publishes a Reference whose content changed (current version wins)", () => {
    const plan = planPublish(
      [{ kind: "reference", id: "verb-conjugation", contentHash: "r2" }],
      [{ kind: "reference", id: "verb-conjugation", contentHash: "r1" }],
    );

    expect(plan.actions).toEqual([
      { type: "put-blob", kind: "reference", id: "verb-conjugation" },
      { type: "upsert-reference", id: "verb-conjugation" },
    ]);
  });

  it("supersedes an existing Lesson when a new Lesson declares it replaces it", () => {
    const plan = planPublish(
      [{ kind: "lesson", id: "0002-greetings", contentHash: "h2", supersedes: "0001-greetings" }],
      [{ kind: "lesson", id: "0001-greetings", contentHash: "h1" }],
    );

    expect(plan.actions).toEqual([
      { type: "put-blob", kind: "lesson", id: "0002-greetings" },
      { type: "insert-lesson", id: "0002-greetings" },
      { type: "mark-superseded", id: "0001-greetings", supersededBy: "0002-greetings" },
    ]);
  });
});
