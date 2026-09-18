// Export every in-lesson quiz of a course to one Excel workbook, ONE SHEET PER
// EDITION. Read-only and secret-guarded; it writes nothing to the Hub.
//
//   pnpm export-quizzes --topic prophetic-school --lang en,es --prod
//   pnpm export-quizzes --topic prophetic-school --lang en,es --prod --out ~/quizzes.xlsx
//
// "Question and answer" here means the authored quiz at the end of each Lesson
// (a session), not the learner Teacher-Q&A channel: `translations` carries no
// `question` rows at all (convex/translate.ts collectItems dropped Q&A in the
// routine cut-over), so a learner question has no Spanish to export, while every
// Lesson body has its quizzes in every Edition.
//
// Where the bodies come from, per Edition:
//   en  ->  routine.materialiseTopic   (the immutable source Lessons)
//   xx  ->  translate.readEditionBodies (the translated projection)
// Both hand back signed blob URLs, which this fetches. The English pass also
// fixes the sheet's row order (Lesson `seq`) and is the fallback body for a
// translated Edition that is missing a Lesson, which is exactly what the reader
// serves in that case.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ExcelJS from "exceljs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret, topicArg } from "./_env";
import { langInfo } from "../convex/languages";
import { SOURCE_LANG } from "../convex/sourceLang";
import { extractQuizzes } from "./quiz-extract";
import { titleFrom } from "./edition-workspace";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
}

const slug = topicArg();
const prod = process.argv.includes("--prod");
const langs = (flag("lang") ?? "en,es").split(",").map((l) => l.trim()).filter(Boolean);
const out = resolve(flag("out") ?? `exports/${slug}-quizzes.xlsx`);

const client = new ConvexHttpClient(convexUrl(prod));
const secret = publishSecret();

async function body(url: string | null, inline?: string): Promise<string | null> {
  if (inline) return inline;
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetching a lesson body failed: ${res.status} ${res.statusText}`);
  return await res.text();
}

// ---- the source Edition: row order, English titles, fallback bodies ----------

const ownerEmail = await client.query(api.translate.topicOwnerEmail, { secret, topicSlug: slug });
if (!ownerEmail) {
  console.error(`No Topic "${slug}" (or it has no owner) on the ${prod ? "prod" : "dev"} deployment.`);
  process.exit(1);
}
const source = await client.query(api.routine.materialiseTopic, { secret, ownerEmail, topicSlug: slug });
if (!source) {
  console.error(`Could not materialise "${slug}".`);
  process.exit(1);
}

type Lesson = { key: string; seq: number; title: string; html: string | null };
const sourceLessons: Lesson[] = [];
for (const l of [...source.lessons].sort((a, b) => a.seq - b.seq)) {
  sourceLessons.push({ key: l.key, seq: l.seq, title: l.title, html: await body(l.htmlUrl) });
}
console.log(`${slug}: ${sourceLessons.length} lessons in the source Edition`);

// ---- one sheet per Edition ---------------------------------------------------

const wb = new ExcelJS.Workbook();
wb.creator = "scripts/export-quizzes.ts";
wb.created = new Date();

const summary: string[] = [];

for (const lang of langs) {
  const info = langInfo(lang);
  // Excel caps a sheet name at 31 chars and refuses []:*?/\ in one.
  const sheetName = `${info.name} (${lang})`.slice(0, 31).replace(/[\[\]:*?/\\]/g, " ");
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  // Five columns, for translators: the sheet is a reading aid, not the edit seam
  // (that is scripts/edition.ts). Everything a translator does not act on stays
  // out, including the lesson key, the quiz number, the type, the two feedback
  // strings and which body was read.
  ws.columns = [
    { header: "Lesson", key: "seq", width: 8 },
    { header: "Title", key: "lessonTitle", width: 42 },
    { header: "Question", key: "question", width: 64 },
    { header: "Options", key: "options", width: 64 },
    { header: "Answer", key: "answer", width: 22 },
  ];

  // A translated Edition's rows, by Lesson key. Absent for the source language.
  const translated = new Map<string, { title?: string; html?: string; url: string | null }>();
  if (lang !== SOURCE_LANG) {
    const rows = await client.query(api.translate.readEditionBodies, { secret, topicSlug: slug, lang });
    if (!rows) {
      console.error(`No Edition rows for "${slug}" in ${lang}; sheet left empty.`);
    } else {
      for (const r of rows) if (r.kind === "lesson") translated.set(r.key, { title: r.title, html: r.html, url: r.url });
    }
  }

  let quizCount = 0;
  let fallbacks = 0;
  for (const lesson of sourceLessons) {
    const row = translated.get(lesson.key);
    const isSource = lang === SOURCE_LANG;
    const html = isSource ? lesson.html : ((await body(row?.url ?? null, row?.html)) ?? lesson.html);
    const usedFallback = !isSource && !row;
    if (usedFallback) fallbacks += 1;
    if (!html) {
      console.error(`  ${lang} ${lesson.key}: no body to read; skipped.`);
      continue;
    }
    const lessonTitle = (isSource ? lesson.title : (row?.title ?? titleFrom(html))) || lesson.title;
    for (const q of extractQuizzes(html)) {
      quizCount += 1;
      ws.addRow({
        seq: lesson.seq,
        lessonTitle,
        question: q.question,
        options: q.options.join("\n"),
        // The answer key itself: the option letter for a multiple choice (the
        // Options cell beside it spells that letter out), the word for a fill-in.
        answer: q.answerKey,
      });
    }
  }

  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columnCount } };
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return;
    r.alignment = { vertical: "top", wrapText: true };
  });
  summary.push(`  ${sheetName}: ${quizCount} questions${fallbacks ? `, ${fallbacks} lessons on the English fallback` : ""}`);
}

mkdirSync(dirname(out), { recursive: true });
try {
  writeFileSync(out, Buffer.from(await wb.xlsx.writeBuffer()));
} catch (e) {
  // Excel keeps an exclusive lock on an open workbook, so a rerun while the last
  // export is still open fails with an errno nobody reads as "close the file".
  if ((e as NodeJS.ErrnoException).code === "EBUSY") {
    console.error(`\n${out} is locked. Close it in Excel and rerun, or pass --out <other path>.`);
    process.exit(1);
  }
  throw e;
}
console.log(summary.join("\n"));
console.log(`\nWrote ${out}`);
