export type ProgressState = "unseen" | "opened" | "completed";

const PROGRESS_RANK: Record<ProgressState, number> = {
  unseen: 0,
  opened: 1,
  completed: 2,
};

/** Progress only ever moves forward — a later report never regresses it. */
export function advanceProgress(current: ProgressState, incoming: ProgressState): ProgressState {
  return PROGRESS_RANK[incoming] > PROGRESS_RANK[current] ? incoming : current;
}

export type ResponseKind = "quiz" | "free_text";

export interface ResponsePayload {
  lessonId: string;
  promptId: string;
  kind: ResponseKind;
  value: string;
  correctness?: boolean;
}

const RESPONSE_KINDS: ResponseKind[] = ["quiz", "free_text"];

function asObject(raw: unknown, subject: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${subject} payload must be an object`);
  }
  return raw as Record<string, unknown>;
}

function requireString(raw: Record<string, unknown>, field: string, subject: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${subject} requires a non-empty ${field}`);
  }
  return value;
}

export function parseResponse(raw: unknown): ResponsePayload {
  const r = asObject(raw, "A Response");

  const lessonId = requireString(r, "lessonId", "A Response");
  const promptId = requireString(r, "promptId", "A Response");
  const value = requireString(r, "value", "A Response");

  if (!RESPONSE_KINDS.includes(r.kind as ResponseKind)) {
    throw new Error(`A Response requires a known kind (one of: ${RESPONSE_KINDS.join(", ")})`);
  }
  const kind = r.kind as ResponseKind;

  const payload: ResponsePayload = { lessonId, promptId, kind, value };
  if (r.correctness !== undefined) {
    payload.correctness = Boolean(r.correctness);
  }
  return payload;
}

export interface QuestionPayload {
  lessonId: string;
  text: string;
}

export function parseQuestion(raw: unknown): QuestionPayload {
  const r = asObject(raw, "A Question");
  return {
    lessonId: requireString(r, "lessonId", "A Question"),
    text: requireString(r, "text", "A Question"),
  };
}
