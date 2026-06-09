import { type NeonQueryFunction } from "@neondatabase/serverless";
import { advanceProgress, type ProgressState } from "../capture/protocol.js";
import { answerQuestion } from "../domain/question.js";
import type {
  HubRepository,
  LessonRecord,
  QuestionRecord,
  ReferenceRecord,
  ResponseRecord,
  Topic,
} from "./repository.js";

type Sql = NeonQueryFunction<false, false>;

const TABLES = [
  "users",
  "topics",
  "lessons",
  "topic_references",
  "responses",
  "questions",
  "replies",
  "progress",
];

/** Wipes every table — for test isolation only. */
export async function resetNeonHub(sql: Sql): Promise<void> {
  await sql.query(`truncate table ${TABLES.join(", ")}`);
}

/** Neon-backed HubRepository. Must satisfy the contract in hubContract.ts. */
export class NeonHubRepository implements HubRepository {
  constructor(private readonly sql: Sql) {}

  async saveTopic(topic: Topic): Promise<void> {
    await this
      .sql`insert into topics (id, user_id, title, mission) values (${topic.id}, ${topic.userId}, ${topic.title}, ${topic.mission})`;
  }

  async listTopics(userId: string): Promise<Topic[]> {
    const rows = await this.sql`select id, user_id, title, mission from topics where user_id = ${userId} order by id`;
    return rows.map((r) => ({ id: r.id, userId: r.user_id, title: r.title, mission: r.mission }));
  }

  async insertLesson(lesson: LessonRecord): Promise<void> {
    await this
      .sql`insert into lessons (id, topic_id, seq, title, r2_key, superseded_by)
           values (${lesson.id}, ${lesson.topicId}, ${lesson.order}, ${lesson.title}, ${lesson.r2Key}, ${lesson.supersededBy ?? null})`;
  }

  async getLesson(id: string): Promise<LessonRecord | undefined> {
    const rows = await this
      .sql`select id, topic_id, seq, title, r2_key, superseded_by from lessons where id = ${id}`;
    return rows[0] ? toLesson(rows[0]) : undefined;
  }

  async listLessons(topicId: string): Promise<LessonRecord[]> {
    const rows = await this
      .sql`select id, topic_id, seq, title, r2_key, superseded_by from lessons where topic_id = ${topicId} order by seq`;
    return rows.map(toLesson);
  }

  async listActiveLessons(topicId: string): Promise<LessonRecord[]> {
    const rows = await this
      .sql`select id, topic_id, seq, title, r2_key, superseded_by from lessons
           where topic_id = ${topicId} and superseded_by is null order by seq`;
    return rows.map(toLesson);
  }

  async markLessonSuperseded(id: string, supersededBy: string): Promise<void> {
    const existing = await this.sql`select id from lessons where id = ${id}`;
    if (existing.length === 0) {
      throw new Error(`Cannot supersede unknown Lesson: ${id}`);
    }
    await this.sql`update lessons set superseded_by = ${supersededBy} where id = ${id}`;
  }

  async upsertReference(reference: ReferenceRecord): Promise<void> {
    await this
      .sql`insert into topic_references (id, topic_id, title, r2_key, content_hash)
           values (${reference.id}, ${reference.topicId}, ${reference.title}, ${reference.r2Key}, ${reference.contentHash})
           on conflict (id) do update set
             topic_id = excluded.topic_id,
             title = excluded.title,
             r2_key = excluded.r2_key,
             content_hash = excluded.content_hash`;
  }

  async listReferences(topicId: string): Promise<ReferenceRecord[]> {
    const rows = await this
      .sql`select id, topic_id, title, r2_key, content_hash from topic_references where topic_id = ${topicId} order by id`;
    return rows.map((r) => ({
      id: r.id,
      topicId: r.topic_id,
      title: r.title,
      r2Key: r.r2_key,
      contentHash: r.content_hash,
    }));
  }

  async openQuestion(input: { id: string; lessonId: string; text: string }): Promise<void> {
    await this
      .sql`insert into questions (id, lesson_id, text, state) values (${input.id}, ${input.lessonId}, ${input.text}, 'open')`;
  }

  async getQuestion(id: string): Promise<QuestionRecord | undefined> {
    const rows = await this
      .sql`select q.id, q.lesson_id, q.text, q.state, r.text as reply_text
           from questions q left join replies r on r.question_id = q.id
           where q.id = ${id}`;
    const row = rows[0];
    if (row === undefined) return undefined;
    const record: QuestionRecord = {
      id: row.id,
      lessonId: row.lesson_id,
      text: row.text,
      state: row.state,
    };
    if (row.reply_text !== null && row.reply_text !== undefined) {
      record.reply = { text: row.reply_text };
    }
    return record;
  }

  async listOpenQuestions(topicId: string): Promise<QuestionRecord[]> {
    const rows = await this
      .sql`select q.id, q.lesson_id, q.text, q.state from questions q
           join lessons l on l.id = q.lesson_id
           where l.topic_id = ${topicId} and q.state = 'open'
           order by q.created_at`;
    return rows.map((r) => ({ id: r.id, lessonId: r.lesson_id, text: r.text, state: r.state }));
  }

  async replyToQuestion(id: string, replyText: string): Promise<void> {
    const question = await this.getQuestion(id);
    if (question === undefined) {
      throw new Error(`Cannot reply to unknown Question: ${id}`);
    }
    // Reuse the domain rule — throws if already answered / reply empty.
    const answered = answerQuestion(question, replyText);
    await this.sql`insert into replies (question_id, text) values (${id}, ${answered.reply!.text})`;
    await this.sql`update questions set state = 'answered' where id = ${id}`;
  }

  async recordResponse(response: ResponseRecord): Promise<void> {
    await this
      .sql`insert into responses (id, lesson_id, prompt_id, kind, value, correctness)
           values (${response.id}, ${response.lessonId}, ${response.promptId}, ${response.kind}, ${response.value}, ${response.correctness ?? null})`;
  }

  async listResponses(lessonId: string): Promise<ResponseRecord[]> {
    const rows = await this
      .sql`select id, lesson_id, prompt_id, kind, value, correctness from responses where lesson_id = ${lessonId} order by created_at`;
    return rows.map((r) => {
      const record: ResponseRecord = {
        id: r.id,
        lessonId: r.lesson_id,
        promptId: r.prompt_id,
        kind: r.kind,
        value: r.value,
      };
      if (r.correctness !== null && r.correctness !== undefined) {
        record.correctness = r.correctness;
      }
      return record;
    });
  }

  async recordProgress(input: { userId: string; lessonId: string; state: ProgressState }): Promise<void> {
    const current = await this.getProgress(input.userId, input.lessonId);
    const next = advanceProgress(current, input.state);
    await this
      .sql`insert into progress (user_id, lesson_id, state) values (${input.userId}, ${input.lessonId}, ${next})
           on conflict (user_id, lesson_id) do update set state = excluded.state, updated_at = now()`;
  }

  async getProgress(userId: string, lessonId: string): Promise<ProgressState> {
    const rows = await this
      .sql`select state from progress where user_id = ${userId} and lesson_id = ${lessonId}`;
    return (rows[0]?.state as ProgressState | undefined) ?? "unseen";
  }
}

function toLesson(r: Record<string, unknown>): LessonRecord {
  const lesson: LessonRecord = {
    id: r.id as string,
    topicId: r.topic_id as string,
    order: r.seq as number,
    title: r.title as string,
    r2Key: r.r2_key as string,
  };
  if (r.superseded_by !== null && r.superseded_by !== undefined) {
    lesson.supersededBy = r.superseded_by as string;
  }
  return lesson;
}
