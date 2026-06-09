import type { HubRepository } from "../hub/repository.js";
import { parseProgress, parseQuestion, parseResponse } from "./protocol.js";

/** Mints unique ids (e.g. crypto.randomUUID in the worker; a counter in tests). */
export type IdGenerator = () => string;

/**
 * The inbound-capture seam the web worker calls. Validates untrusted payloads
 * via the Capture protocol, then persists through the Hub repository port.
 * Holds no transport or storage detail, so it is testable against any adapter.
 */
export class CaptureService {
  constructor(
    private readonly hub: HubRepository,
    private readonly nextId: IdGenerator,
  ) {}

  async submitResponse(raw: unknown): Promise<void> {
    const payload = parseResponse(raw);
    await this.hub.recordResponse({ id: this.nextId(), ...payload });
  }

  async askQuestion(raw: unknown): Promise<void> {
    const payload = parseQuestion(raw);
    await this.hub.openQuestion({
      id: this.nextId(),
      lessonId: payload.lessonId,
      text: payload.text,
    });
  }

  async reportProgress(userId: string, raw: unknown): Promise<void> {
    const payload = parseProgress(raw);
    await this.hub.recordProgress({ userId, lessonId: payload.lessonId, state: payload.state });
  }
}
