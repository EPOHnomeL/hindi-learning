import { useMemo, useState } from "react";
import {
  lessons,
  references,
  seedProgress,
  seedQuestions,
  topic,
  type ProgressState,
  type Question,
} from "./mock";

const RANK: Record<ProgressState, number> = { unseen: 0, opened: 1, completed: 2 };
function advance(current: ProgressState, incoming: ProgressState): ProgressState {
  return RANK[incoming] > RANK[current] ? incoming : current;
}

export type View = "topic" | "lesson" | "thread";

export interface CapturedResponse {
  lessonId: string;
  promptId: string;
  value: string;
  correct: boolean;
}

export interface PrototypeApp {
  topic: typeof topic;
  lessons: typeof lessons;
  references: typeof references;
  // navigation
  view: View;
  currentLessonId: string | null;
  goTopic: () => void;
  goThread: () => void;
  openLesson: (id: string) => void;
  // state
  progress: Record<string, ProgressState>;
  questions: Question[];
  responses: CapturedResponse[];
  // captures
  completeLesson: (id: string) => void;
  submitResponse: (lessonId: string, promptId: string, value: string, correct: boolean) => void;
  askQuestion: (lessonId: string, text: string) => void;
  // derived
  openQuestionCount: number;
  lessonOf: (id: string) => (typeof lessons)[number] | undefined;
}

export function usePrototypeApp(): PrototypeApp {
  const [view, setView] = useState<View>("topic");
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressState>>({ ...seedProgress });
  const [questions, setQuestions] = useState<Question[]>([...seedQuestions]);
  const [responses, setResponses] = useState<CapturedResponse[]>([]);
  const [nextId, setNextId] = useState(1);

  const bump = (id: string, to: ProgressState) =>
    setProgress((p) => ({ ...p, [id]: advance(p[id] ?? "unseen", to) }));

  const openLesson = (id: string) => {
    setCurrentLessonId(id);
    setView("lesson");
    bump(id, "opened");
  };

  return {
    topic,
    lessons,
    references,
    view,
    currentLessonId,
    goTopic: () => setView("topic"),
    goThread: () => setView("thread"),
    openLesson,
    progress,
    questions,
    responses,
    completeLesson: (id) => bump(id, "completed"),
    submitResponse: (lessonId, promptId, value, correct) =>
      setResponses((r) => [...r, { lessonId, promptId, value, correct }]),
    askQuestion: (lessonId, text) => {
      setQuestions((q) => [...q, { id: `qn-new-${nextId}`, lessonId, text }]);
      setNextId((n) => n + 1);
    },
    openQuestionCount: useMemo(() => questions.filter((q) => q.reply === undefined).length, [questions]),
    lessonOf: (id) => lessons.find((l) => l.id === id),
  };
}
