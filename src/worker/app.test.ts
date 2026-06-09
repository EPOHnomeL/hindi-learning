import { describe, expect, it } from "vitest";
import { CaptureService } from "../capture/service.js";
import { InMemoryHubRepository } from "../hub/repository.js";
import { createApp } from "./app.js";

function setup() {
  const hub = new InMemoryHubRepository();
  let n = 0;
  const capture = new CaptureService(hub, () => `id-${++n}`);
  const app = createApp({ hub, capture, currentUserId: () => "me" });
  return { hub, app };
}

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("worker API", () => {
  it("GET /api/topics returns only the authenticated user's Topics", async () => {
    const { hub, app } = setup();
    await hub.saveTopic({ id: "t1", userId: "me", title: "Hindi", mission: "m" });
    await hub.saveTopic({ id: "t2", userId: "other", title: "Yoga", mission: "m" });

    const res = await app.request("/api/topics");
    expect(res.status).toBe(200);
    expect((await res.json()).map((t: { id: string }) => t.id)).toEqual(["t1"]);
  });

  it("POST /api/responses persists a valid Response (201)", async () => {
    const { hub, app } = setup();
    await hub.insertLesson({ id: "l1", topicId: "t1", order: 1, title: "L", r2Key: "k" });

    const res = await app.request("/api/responses", json({ lessonId: "l1", promptId: "q1", kind: "quiz", value: "b" }));

    expect(res.status).toBe(201);
    expect(await hub.listResponses("l1")).toHaveLength(1);
  });

  it("POST /api/responses rejects an invalid (prompt-less) Response with 400", async () => {
    const { app } = setup();

    const res = await app.request("/api/responses", json({ lessonId: "l1", kind: "quiz", value: "b" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/prompt/i);
  });

  it("POST /api/questions opens a Question listed under its Topic", async () => {
    const { hub, app } = setup();
    await hub.insertLesson({ id: "l1", topicId: "t1", order: 1, title: "L", r2Key: "k" });

    const res = await app.request("/api/questions", json({ lessonId: "l1", text: "why?" }));

    expect(res.status).toBe(201);
    expect(await hub.listOpenQuestions("t1")).toHaveLength(1);
  });

  it("POST /api/progress records advance-only Progress for the user", async () => {
    const { hub, app } = setup();
    await hub.insertLesson({ id: "l1", topicId: "t1", order: 1, title: "L", r2Key: "k" });

    await app.request("/api/progress", json({ lessonId: "l1", state: "completed" }));
    await app.request("/api/progress", json({ lessonId: "l1", state: "opened" }));

    expect(await hub.getProgress("me", "l1")).toBe("completed");
  });
});
