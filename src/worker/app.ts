import { Hono, type Context } from "hono";
import type { ArtifactStore } from "../hub/artifactStore.js";
import type { CaptureService } from "../capture/service.js";
import type { HubRepository } from "../hub/repository.js";

export interface AppDeps {
  hub: HubRepository;
  artifacts: ArtifactStore;
  capture: CaptureService;
  /** Resolves the authenticated user (Neon Auth later; a dev stub for now). */
  currentUserId: (c: Context) => string;
}

/**
 * The Hono API for the Served Teach App. Pure wiring over the Hub repository
 * and the CaptureService — no storage or runtime detail, so it is exercised in
 * tests with the in-memory adapter (see app.test.ts).
 */
export function createApp(deps: AppDeps) {
  const app = new Hono();

  // --- Reads (the reader pulls these) ---
  app.get("/api/topics", async (c) => c.json(await deps.hub.listTopics(deps.currentUserId(c))));
  app.get("/api/topics/:id/lessons", async (c) => c.json(await deps.hub.listActiveLessons(c.req.param("id"))));
  app.get("/api/topics/:id/references", async (c) => c.json(await deps.hub.listReferences(c.req.param("id"))));
  app.get("/api/topics/:id/questions", async (c) => c.json(await deps.hub.listOpenQuestions(c.req.param("id"))));

  // The rendered Lesson HTML blob, streamed from the Artifact store (R2).
  app.get("/api/lessons/:id/html", async (c) => {
    const lesson = await deps.hub.getLesson(c.req.param("id"));
    if (lesson === undefined) return c.notFound();
    const html = await deps.artifacts.get(lesson.r2Key);
    if (html === undefined) return c.notFound();
    return c.html(html);
  });

  // --- Captures (the lesson posts these) ---
  app.post("/api/responses", (c) => capture(c, async (body) => deps.capture.submitResponse(body)));
  app.post("/api/questions", (c) => capture(c, async (body) => deps.capture.askQuestion(body)));
  app.post("/api/progress", (c) =>
    capture(c, async (body) => deps.capture.reportProgress(deps.currentUserId(c), body)),
  );

  return app;
}

/** Parse the JSON body, run the capture, and map validation failures to 400. */
async function capture(c: Context, run: (body: unknown) => Promise<void>) {
  try {
    await run(await c.req.json());
    return c.body(null, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Invalid request" }, 400);
  }
}
