export type QuestionState = "open" | "answered";

export interface Reply {
  text: string;
}

export interface Question {
  lessonId: string;
  text: string;
  state: QuestionState;
  reply?: Reply;
}

export function openQuestion(input: { lessonId: string; text: string }): Question {
  if (input.lessonId.trim() === "") {
    throw new Error("A Question must reference a Lesson");
  }
  if (input.text.trim() === "") {
    throw new Error("A Question must have non-empty text");
  }
  return {
    lessonId: input.lessonId,
    text: input.text,
    state: "open",
  };
}

export function answerQuestion(question: Question, replyText: string): Question {
  if (question.state === "answered") {
    throw new Error("Cannot answer a Question that is already answered");
  }
  if (replyText.trim() === "") {
    throw new Error("A Reply must have non-empty text");
  }
  return {
    ...question,
    state: "answered",
    reply: { text: replyText },
  };
}
