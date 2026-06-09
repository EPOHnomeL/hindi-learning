import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryHubRepository, type HubRepository } from "./repository.js";

let hub: HubRepository;

beforeEach(() => {
  hub = new InMemoryHubRepository();
});

describe("Topics", () => {
  it("lists only the Topics belonging to the given user", async () => {
    await hub.saveTopic({ id: "t1", userId: "me", title: "Hindi", mission: "Read the Bible in Hindi" });
    await hub.saveTopic({ id: "t2", userId: "someone-else", title: "Yoga", mission: "..." });

    const mine = await hub.listTopics("me");

    expect(mine.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("Lessons", () => {
  it("lists active Lessons of a Topic in author order", async () => {
    await hub.insertLesson({ id: "l2", topicId: "t1", order: 2, title: "Numbers", r2Key: "k2" });
    await hub.insertLesson({ id: "l1", topicId: "t1", order: 1, title: "Greetings", r2Key: "k1" });

    const lessons = await hub.listActiveLessons("t1");

    expect(lessons.map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  it("excludes a superseded Lesson from the active list but keeps it retrievable", async () => {
    await hub.insertLesson({ id: "l1", topicId: "t1", order: 1, title: "Greetings", r2Key: "k1" });
    await hub.insertLesson({ id: "l2", topicId: "t1", order: 2, title: "Greetings v2", r2Key: "k2" });

    await hub.markLessonSuperseded("l1", "l2");

    expect((await hub.listActiveLessons("t1")).map((l) => l.id)).toEqual(["l2"]);
    expect((await hub.listLessons("t1")).map((l) => l.id)).toEqual(["l1", "l2"]);
  });
});

describe("References", () => {
  it("upserts a Reference so only the current version is kept", async () => {
    await hub.upsertReference({ id: "ref1", topicId: "t1", title: "Verbs", r2Key: "rk1", contentHash: "h1" });
    await hub.upsertReference({ id: "ref1", topicId: "t1", title: "Verbs", r2Key: "rk2", contentHash: "h2" });

    const refs = await hub.listReferences("t1");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.r2Key).toBe("rk2");
    expect(refs[0]?.contentHash).toBe("h2");
  });
});

describe("Questions and Replies", () => {
  beforeEach(async () => {
    await hub.insertLesson({ id: "l1", topicId: "t1", order: 1, title: "Greetings", r2Key: "k1" });
  });

  it("lists an open Question under the Topic of its Lesson", async () => {
    await hub.openQuestion({ id: "q1", lessonId: "l1", text: "Formal vs informal you?" });

    const open = await hub.listOpenQuestions("t1");

    expect(open.map((q) => q.id)).toEqual(["q1"]);
    expect(open[0]?.state).toBe("open");
  });

  it("answers a Question with a Reply, removing it from the open list", async () => {
    await hub.openQuestion({ id: "q1", lessonId: "l1", text: "Formal vs informal you?" });

    await hub.replyToQuestion("q1", "Use आप for formal, तुम for informal.");

    expect(await hub.listOpenQuestions("t1")).toEqual([]);
    const answered = await hub.getQuestion("q1");
    expect(answered?.state).toBe("answered");
    expect(answered?.reply).toEqual({ text: "Use आप for formal, तुम for informal." });
  });

  it("rejects replying to an already-answered Question", async () => {
    await hub.openQuestion({ id: "q1", lessonId: "l1", text: "Formal vs informal you?" });
    await hub.replyToQuestion("q1", "first");

    await expect(hub.replyToQuestion("q1", "second")).rejects.toThrow(/already answered/i);
  });
});

describe("Responses", () => {
  it("records Responses and lists them for their Lesson only", async () => {
    await hub.recordResponse({ id: "rsp1", lessonId: "l1", promptId: "q1", kind: "quiz", value: "b", correctness: true });
    await hub.recordResponse({ id: "rsp2", lessonId: "l2", promptId: "q1", kind: "quiz", value: "a" });

    const forL1 = await hub.listResponses("l1");

    expect(forL1.map((r) => r.id)).toEqual(["rsp1"]);
  });
});

describe("Progress", () => {
  it("defaults to unseen for a Lesson never opened", async () => {
    expect(await hub.getProgress("me", "l1")).toBe("unseen");
  });

  it("advances and never regresses", async () => {
    await hub.recordProgress({ userId: "me", lessonId: "l1", state: "completed" });
    await hub.recordProgress({ userId: "me", lessonId: "l1", state: "opened" });

    expect(await hub.getProgress("me", "l1")).toBe("completed");
  });
});
