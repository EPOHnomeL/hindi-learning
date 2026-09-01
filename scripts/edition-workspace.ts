// The pure half of the Edition round-trip (scripts/edition.ts): workspace layout,
// change detection, and the gates that decide what may be pushed. No I/O and no
// Convex here, so every rule below is directly testable. That matters, because the
// two one-off round-trips this framework generalises (the st-ZA orthography rewrite
// and the hi-Latn to hi Devanagari conversion) each shipped content past a guard
// that turned out to be dead code.
import { quizStructureMatches } from "../convex/translate";

export type Kind = "lesson" | "reference" | "mission" | "title" | "question";

/** One pulled row, as recorded in the workspace's edition.json. */
export type Item = {
  kind: Kind;
  key: string;
  /** The row's stored title. Documents re-derive it from <title>; this is the fallback. */
  title?: string;
  /** Workspace-relative path, WITHOUT the pristine/ or working/ prefix. */
  file: string;
  /**
   * The body lived in a _storage blob at pull time. Such a row may still be sharing
   * that blob with the Edition it was cloned from, so it MUST be republished (which
   * writes the body inline and clears htmlStorageId) even when the local bytes are
   * unchanged, or the "edit" never lands. Learned the hard way on st-ZA.
   */
  blobBacked: boolean;
};

export type Manifest = {
  topicSlug: string;
  lang: string;
  deployment: "prod" | "dev";
  /**
   * The registered email of the Topic's OWNER, which is not whoever runs the script
   * and not necessarily OWNER_EMAIL from .env.local. publishTranslation resolves the
   * Topic by (owner, slug) and throws when it does not match, and Convex redacts
   * thrown errors in production, so a wrong value surfaces only as an opaque "Server
   * Error". Pull resolves it once and writes it here so push never has to guess.
   */
  ownerEmail: string | null;
  pulledAt: string;
  items: Item[];
};

/** What push will send for one item: a document body, or a text row's string. */
export type Body = { html: string; title: string } | { text: string };

export type Send = { item: Item; body: Body; reason: "edited" | "blob-backed" | "forced" };
export type Problem = { item: Item; problem: string; detail?: string };
export type Plan = { send: Send[]; unchanged: Item[]; problems: Problem[] };

/** Where a row's body lives inside a workspace tree. Mirrors scripts/publish-translation.ts. */
export function fileFor(kind: Kind, key: string): string {
  if (kind === "title") return "title.txt";
  if (kind === "mission") return "mission.txt";
  // A key reaches the filesystem as a path segment, so anything that could climb out
  // of the workspace is refused rather than sanitised: a silently renamed key would
  // push back to the wrong row.
  if (key === "" || /[\/\\]|^\.\.?$/.test(key)) throw new Error(`unusable key for a ${kind} file: ${JSON.stringify(key)}`);
  if (kind === "lesson") return `lessons/${key}.html`;
  if (kind === "reference") return `references/${key}.html`;
  throw new Error(`no workspace file for kind ${JSON.stringify(kind)}`);
}

/**
 * The per-item title lives in the document's own <title>, so editing the heading edits
 * the title too and there is no second file to keep in sync. Mirrors publish.ts and
 * publish-translation.ts, including stripping a "Brand · " prefix.
 */
export function titleFrom(html: string): string {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const parts = raw.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : raw).trim();
}

/**
 * Decide what to push. `read` takes a tree-prefixed path ("working/lessons/x.html")
 * and returns its contents, or null when the file is absent.
 *
 * Nothing is sent that trips a gate: an item with a problem is reported and excluded,
 * and the caller refuses the whole run rather than shipping the rest. Half a converted
 * Edition is a worse state than none of one.
 */
export function planPush(manifest: Manifest, read: (path: string) => string | null, opts: { all?: boolean } = {}): Plan {
  const plan: Plan = { send: [], unchanged: [], problems: [] };
  for (const item of manifest.items) {
    const fail = (problem: string, detail?: string) => plan.problems.push({ item, problem, detail });

    // Learner Q&A, not course content. Pull never writes these, so a hand-added one is
    // a mistake rather than an instruction.
    if (item.kind === "question") {
      fail("unsupported", "question rows are learner Q&A and are not editable here");
      continue;
    }

    const working = read(`working/${item.file}`);
    const pristine = read(`pristine/${item.file}`);
    if (working === null) {
      fail("missing", `no working/${item.file}. Deleting a file does not delete the row; restore it or re-pull`);
      continue;
    }
    if (pristine === null) {
      fail("missing-pristine", `no pristine/${item.file}. The comparison basis is gone; re-pull`);
      continue;
    }

    const changed = working !== pristine;
    const reason: Send["reason"] = changed ? "edited" : item.blobBacked ? "blob-backed" : "forced";
    if (!changed && !item.blobBacked && !opts.all) {
      plan.unchanged.push(item);
      continue;
    }

    if (item.kind === "title" || item.kind === "mission") {
      const text = working.trim();
      // A blank text row is DELETED server-side and the reader falls back to English.
      // That is a real operation but never an accidental one, and an emptied file is far
      // more likely a slipped editor than a deliberate revert.
      if (text === "") {
        fail("empty", `working/${item.file} is blank. Blank reverts the row to the English source; do that deliberately, not by saving an empty file`);
        continue;
      }
      plan.send.push({ item, body: { text }, reason });
      continue;
    }

    // A surviving swapOutStatic placeholder means the document was never put back
    // together, and publishing it ships a lesson with its <style>/<script> missing.
    if (working.includes("⟦")) {
      fail("placeholder", `working/${item.file} still holds the swapOutStatic block placeholders. Run swapBackStatic before pushing`);
      continue;
    }
    // Only a Lesson carries quiz markers. This compares against the PRISTINE pulled
    // body, which is a local and precise check; publishTranslationChecked re-runs it
    // server-side against the English source and is the authoritative one.
    if (item.kind === "lesson" && !quizStructureMatches(pristine, working)) {
      fail("quiz-drift", `working/${item.file} changed the quiz markers (data-correct / data-answer / data-k). The server would skip it and the reader would fall back to English`);
      continue;
    }
    // The stored row title (what lesson lists and cards render) and the document's
    // own <title> can legitimately disagree: an Edition translated in more than one
    // pass has rows whose stored title came from an older, rougher pass than the
    // body did. Deriving the title from the document on EVERY push would silently
    // rewrite every one of those the first time any unrelated row was sent, which on
    // prophetic-school/es would have been 40 titles nobody asked to change. So the
    // document only wins when the operator actually edited it. Otherwise the stored
    // title round-trips untouched, and push changes exactly what you changed.
    const workingTitle = titleFrom(working);
    const title = workingTitle !== titleFrom(pristine) ? workingTitle : (item.title ?? workingTitle);
    if (!title) {
      // publishTranslation is a db.replace: a title left out is DROPPED, not kept.
      fail("no-title", `working/${item.file} has no <title> and the row carried none. Publishing would clear the stored title`);
      continue;
    }
    plan.send.push({ item, body: { html: working, title }, reason });
  }
  return plan;
}
