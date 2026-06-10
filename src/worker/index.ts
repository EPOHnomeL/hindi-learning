import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";
import { CaptureService } from "../capture/service.js";
import { R2ArtifactStore, type R2BucketLike } from "../hub/artifactStore.js";
import { NeonHubRepository } from "../hub/neonRepository.js";
import { createApp } from "./app.js";
import { makeUserResolver } from "./auth.js";

export interface Env {
  DATABASE_URL: string;
  ARTIFACTS: R2BucketLike;
  /** Neon Auth / Stack project id (ADR-0006). Unset → auth disabled, dev user. */
  STACK_PROJECT_ID?: string;
  /** When auth is unconfigured, the identity to fall back to (local dev). */
  DEV_USER_ID?: string;
}

type Vars = { userId: string };

// Worker entry. Builds the real dependencies from env (Neon Hub) and serves the
// Hono app behind a Neon Auth middleware (ADR-0006): it verifies the session JWT
// and sets the user id on the request context. When Neon Auth is not configured
// (no STACK_PROJECT_ID), the resolver yields undefined and we fall back to a dev
// user, so local dev runs without auth.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const hub = new NeonHubRepository(neon(env.DATABASE_URL));
    const artifacts = new R2ArtifactStore(env.ARTIFACTS);
    const capture = new CaptureService(hub, () => crypto.randomUUID());
    const resolveUser = makeUserResolver(env);
    const devUser = env.DEV_USER_ID ?? "dev-user";

    const api = createApp({
      hub,
      artifacts,
      capture,
      currentUserId: (c) => c.get("userId"),
    });

    const root = new Hono<{ Variables: Vars }>();
    root.use("*", async (c, next) => {
      c.set("userId", (await resolveUser(c.req.raw)) ?? devUser);
      await next();
    });
    root.route("/", api);
    return root.fetch(request, env);
  },
};
