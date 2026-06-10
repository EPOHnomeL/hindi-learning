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

const json = (r: Response) => {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
};

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  topics: (): Promise<Topic[]> => fetch("/api/topics").then(json),
  lessons: (topicId: string): Promise<Lesson[]> => fetch(`/api/topics/${topicId}/lessons`).then(json),
  references: (topicId: string): Promise<Reference[]> => fetch(`/api/topics/${topicId}/references`).then(json),
  openQuestions: (topicId: string): Promise<Question[]> => fetch(`/api/topics/${topicId}/questions`).then(json),
  lessonHtml: async (lessonId: string): Promise<string> => {
    const r = await fetch(`/api/lessons/${lessonId}/html`);
    if (!r.ok) throw new Error(`${r.status}`);
    return r.text();
  },
  referenceHtml: async (referenceId: string): Promise<string> => {
    const r = await fetch(`/api/references/${referenceId}/html`);
    if (!r.ok) throw new Error(`${r.status}`);
    return r.text();
  },
  ask: (lessonId: string, text: string) => fetch("/api/questions", post({ lessonId, text })),
  progress: (lessonId: string, state: ProgressState) => fetch("/api/progress", post({ lessonId, state })),
  respond: (lessonId: string, r: { promptId: string; kind: ResponseKind; value: string; correctness?: boolean }) =>
    fetch("/api/responses", post({ lessonId, ...r })),
};
