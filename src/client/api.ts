// Typed client for the worker API. Calls are relative (/api/*) so they work in
// dev (Vite proxy → wrangler) and in prod (same-origin Worker).

export type ProgressState = "unseen" | "opened" | "completed";
export type ResponseKind = "quiz" | "free_text";

export interface Topic {
  id: string;
  userId: string;
  title: string;
  mission: string;
}

export interface Lesson {
  id: string;
  topicId: string;
  order: number;
  title: string;
  r2Key: string;
  supersededBy?: string;
}

export interface Reference {
  id: string;
  topicId: string;
  title: string;
  r2Key: string;
  contentHash: string;
}

export interface Question {
  id: string;
  lessonId: string;
  text: string;
  state: "open" | "answered";
  reply?: { text: string };
}

// Neon Auth (ADR-0006): the Stack provider sets the learner's access token here
// once signed in; every request then carries it as a bearer token, which the
// worker verifies (src/worker/auth.ts). Until auth is wired this stays undefined
// and the worker falls back to the dev user.
let authToken: string | undefined;
export const setAuthToken = (token: string | undefined) => {
  authToken = token;
};
const authHeaders = (): Record<string, string> =>
  authToken ? { authorization: `Bearer ${authToken}` } : {};

const json = (r: Response) => {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
};

const get = (url: string) => fetch(url, { headers: authHeaders() });

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...authHeaders() },
  body: JSON.stringify(body),
});

export const api = {
  topics: (): Promise<Topic[]> => get("/api/topics").then(json),
  lessons: (topicId: string): Promise<Lesson[]> => get(`/api/topics/${topicId}/lessons`).then(json),
  references: (topicId: string): Promise<Reference[]> => get(`/api/topics/${topicId}/references`).then(json),
  openQuestions: (topicId: string): Promise<Question[]> => get(`/api/topics/${topicId}/questions`).then(json),
  progressMap: (topicId: string): Promise<Record<string, ProgressState>> =>
    get(`/api/topics/${topicId}/progress`).then(json),
  lessonHtml: async (lessonId: string): Promise<string> => {
    const r = await get(`/api/lessons/${lessonId}/html`);
    if (!r.ok) throw new Error(`${r.status}`);
    return r.text();
  },
  referenceHtml: async (referenceId: string): Promise<string> => {
    const r = await get(`/api/references/${referenceId}/html`);
    if (!r.ok) throw new Error(`${r.status}`);
    return r.text();
  },
  ask: (lessonId: string, text: string) => fetch("/api/questions", post({ lessonId, text })),
  progress: (lessonId: string, state: ProgressState) => fetch("/api/progress", post({ lessonId, state })),
  respond: (lessonId: string, r: { promptId: string; kind: ResponseKind; value: string; correctness?: boolean }) =>
    fetch("/api/responses", post({ lessonId, ...r })),
};
