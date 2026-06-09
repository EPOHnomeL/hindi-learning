// The Artifact store (R2) holds Lesson/Reference HTML blobs (ADR-0005). The
// port keeps the worker testable; the R2 adapter is a thin wrapper over the
// bound bucket, the in-memory one is the test double.

export interface ArtifactStore {
  get(key: string): Promise<string | undefined>;
  put(key: string, html: string): Promise<void>;
}

export class InMemoryArtifactStore implements ArtifactStore {
  private blobs = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.blobs.get(key);
  }

  async put(key: string, html: string): Promise<void> {
    this.blobs.set(key, html);
  }
}

/** Minimal structural type for an R2 bucket binding (avoids a workers-types dep). */
export interface R2BucketLike {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string, options?: unknown): Promise<unknown>;
}

export class R2ArtifactStore implements ArtifactStore {
  constructor(private readonly bucket: R2BucketLike) {}

  async get(key: string): Promise<string | undefined> {
    const object = await this.bucket.get(key);
    return object ? await object.text() : undefined;
  }

  async put(key: string, html: string): Promise<void> {
    await this.bucket.put(key, html, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
  }
}
