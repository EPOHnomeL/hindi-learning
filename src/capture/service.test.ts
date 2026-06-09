import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryHubRepository, type HubRepository } from "../hub/repository.js";
import { CaptureService } from "./service.js";

let hub: HubRepository;
let service: CaptureService;

beforeEach(async () => {
  hub = new InMemoryHubRepository();
  let n = 0;
  service = new CaptureService(hub, () => `id-${++n}`);
  await hub.insertLesson({ id: "l1", topicId: "t1", order: 1, title: "Greetings", r2Key: "k1" });
});

describe("CaptureService.submitResponse", () => {
  it("validates and persists a Response with a generated id", async () => {
    await service.submitResponse({
      lessonId: "l1",
      promptId: "q1",
      kind: "quiz",
      value: "b",
      correctness: true,
    });

    const responses = await hub.listResponses("l1");
    expect(responses).toHaveLength(1);
    expect(responses[0]?.id).toBe("id-1");
  });

  it("rejects an invalid Response and persists nothing", async () => {
    await expect(
      service.submitResponse({ lessonId: "l1", kind: "quiz", value: "b" }),
    ).rejects.toThrow(/prompt/i);

    expect(await hub.listResponses("l1")).toEqual([]);
  });
});

describe("CaptureService.askQuestion", () => {
  it("opens a Question listed under the Lesson's Topic", async () => {
    await service.askQuestion({ lessonId: "l1", text: "Formal vs informal you?" });

    const open = await hub.listOpenQuestions("t1");
    expect(open.map((q) => q.id)).toEqual(["id-1"]);
  });
});

describe("CaptureService.reportProgress", () => {
  it("records advance-only Progress for the authenticated user", async () => {
    await service.reportProgress("me", { lessonId: "l1", state: "completed" });
    await service.reportProgress("me", { lessonId: "l1", state: "opened" });

    expect(await hub.getProgress("me", "l1")).toBe("completed");
  });
});
