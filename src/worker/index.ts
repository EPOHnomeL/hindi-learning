import { neon } from "@neondatabase/serverless";
import { CaptureService } from "../capture/service.js";
import { R2ArtifactStore, type R2BucketLike } from "../hub/artifactStore.js";
import { NeonHubRepository } from "../hub/neonRepository.js";
import { createApp } from "./app.js";

export interface Env {
  DATABASE_URL: string;
  ARTIFACTS: R2BucketLike;
}

// Worker entry. Builds the real dependencies from env (Neon Hub) and serves the
// Hono app. Auth is a dev stub for now — Neon Auth wiring (ADR-0006) replaces
// `currentUserId` with the verified user from the session.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const hub = new NeonHubRepository(neon(env.DATABASE_URL));
    const artifacts = new R2ArtifactStore(env.ARTIFACTS);
    const capture = new CaptureService(hub, () => crypto.randomUUID());
    const app = createApp({
      hub,
      artifacts,
      capture,
      currentUserId: () => "dev-user", // TODO(neon-auth): resolve from session
    });
    return app.fetch(request, env);
  },
};
