// Lesson HTML into the words a narrator should actually say. (Plain module, no
// Convex functions registered here; pure, so it is unit-tested rather than
// exercised through an action.)
//
// The reader's Lesson body is a full authored HTML document (see
// `src/app/_components/lessonSrcDoc.ts` for what is in one). A TTS request wants
// prose, so this drops the three things that are not prose:
//
//  - `<script>` / `<style>`: never spoken, and a stylesheet read aloud is the
//    worst possible failure mode.
//  - **Quiz blocks** (`.quiz`): the authoring contract's MCQ / fill-in cards.
//    Reading "1. Pick one / Option A / Option B / tick" aloud is noise. A quiz is
//    something the learner DOES, and the deferred course-audio note
//    (`.plan/maps/authoring/assets/deferred/course-audio.md`) scoped listening as
//    study media, not as a way to answer questions. They are removed whole, which
//    also takes their `.opts` and `.fb` feedback strings with them.
//  - Every remaining tag, with block-level ones becoming paragraph breaks so the
//    voice pauses where the page does rather than running headings into body text.

// Tags after which a narrator should stop for breath. Everything else (inline
// `<em>`, `<strong>`, `<a>`, and friends) closes without a break so a bolded word
// does not split a sentence in two.
const BLOCK = /<\/?(p|div|section|article|h[1-6]|li|ul|ol|tr|td|th|table|blockquote|br|hr|header|footer|figure|figcaption|dt|dd)\b[^>]*>/gi;

// The named/numeric entities that actually show up in authored prose. Same set
// as `decodeEntities` in `contentBlobs.ts` plus `&nbsp;`, which is common in
// body copy and would otherwise be spoken as literal text.
// ponytail: extend the map if a new one appears; a stray entity reads as itself,
// which is ugly but not wrong.
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
  // Typographic entities, added 2026-11-24: prophetic-school carries a literal
  // `&ndash;` in eight places, and a narrator read it out as "and n dash".
  ndash: String.fromCharCode(0x2013),
  mdash: String.fromCharCode(0x2014),
  hellip: String.fromCharCode(0x2026),
  lsquo: String.fromCharCode(0x2018),
  rsquo: String.fromCharCode(0x2019),
  ldquo: String.fromCharCode(0x201c),
  rdquo: String.fromCharCode(0x201d),
};

// Remove every element whose opening tag matches `open`, along with its
// children, by walking tag depth forward from each match. A regex alone cannot
// do this: `.quiz` cards contain nested `<div>`s, so a lazy
// `<div class="quiz".*?</div>` stops at the FIRST inner close and leaves the
// card's tail (options, feedback) in the narration.
function dropElements(html: string, open: RegExp, tag: string): string {
  const openTag = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const closeTag = new RegExp(`</${tag}\\s*>`, "gi");
  let out = "";
  let cursor = 0;
  const finder = new RegExp(open.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = finder.exec(html)) !== null) {
    // A match inside a region we already dropped is stale, so skip it.
    if (m.index < cursor) continue;
    out += html.slice(cursor, m.index);
    // Walk forward from just past the opening tag, counting nested opens
    // against closes until the element balances.
    let depth = 1;
    let pos = m.index + m[0].length;
    while (depth > 0 && pos < html.length) {
      openTag.lastIndex = pos;
      closeTag.lastIndex = pos;
      const nextOpen = openTag.exec(html);
      const nextClose = closeTag.exec(html);
      // Unbalanced markup (no close left): drop the rest rather than emit half
      // a quiz card. Authored HTML is generated, so this should not happen.
      if (!nextClose) {
        pos = html.length;
        break;
      }
      if (nextOpen && nextOpen.index < nextClose.index) {
        depth += 1;
        pos = nextOpen.index + nextOpen[0].length;
      } else {
        depth -= 1;
        pos = nextClose.index + nextClose[0].length;
      }
    }
    cursor = pos;
    finder.lastIndex = pos;
  }
  return out + html.slice(cursor);
}

function decode(s: string): string {
  return s.replace(/&(#39|[a-z]+);/g, (raw, e: string) => ENTITIES[e] ?? raw);
}

/**
 * The narration script for a Lesson body: its prose, with quiz cards and markup
 * removed and block boundaries turned into paragraph breaks.
 */
export function narrationFromHtml(html: string): string {
  let s = html;
  s = dropElements(s, /<script\b[^>]*>/, "script");
  s = dropElements(s, /<style\b[^>]*>/, "style");
  // The document `<title>` is the browser tab's label, not part of the lesson. It
  // repeats the heading that follows, so narrating it opened every lesson by
  // saying its name twice (found 2026-11-24, reading a pulled script).
  s = dropElements(s, /<title\b[^>]*>/, "title");
  // `class="quiz"`, `class="quiz fill"`, `class="card quiz"`: the token, not a
  // prefix, so a `.quizzical` class (none today) would not be swallowed.
  s = dropElements(s, /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bquiz\b[^"']*["'][^>]*>/, "div");
  // HTML comments carry authoring notes, never speech.
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // Block tags become breaks; every other tag simply disappears.
  s = s.replace(BLOCK, "\n").replace(/<[^>]+>/g, "");
  s = decode(s);
  // Collapse runs of spaces inside a line, then drop blank lines between them,
  // so the result is one paragraph per line with no leading indent.
  return s
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

const EN_DASH = String.fromCharCode(0x2013);
const RANGE = `(?:-|${EN_DASH})`;

/**
 * A narration script rewritten the way a person would SAY it, for a speech model
 * that reads characters literally.
 *
 * Kokoro, the model `scripts/narrate.ts` renders with, does no text
 * normalisation of its own: handed "John 16:13" it says "sixteen thirteen",
 * "~10 min" comes out as a tilde, and a middle dot or an arrow is silently
 * dropped so two phrases run together. Every rule below is for a pattern counted
 * in prophetic-school on 2026-11-24 (422 chapter-and-verse references, 748 middle
 * dots, 252 number ranges, 85 arrows, 57 "~10 min"), not a general-purpose
 * normaliser.
 *
 * ponytail: any `digits:digits` is read as chapter and verse. True of this
 * course; a lesson that quotes a clock time would want that rule narrowed.
 */
export function speakable(text: string): string {
  return (
    text
      // The authored cross-reference shorthand, in its paired forms, before the
      // generic rules below get half of each: "L16(en dash)L19" is Lessons 16 to
      // 19, "L6/18" is Lesson 6 or 18, and the section sign ranges the same way.
      // (The generic range rule wants a digit on BOTH sides of the dash, and the
      // generic slash rule a letter after it, so neither sees these.)
      .replace(new RegExp(`\\bL(\\d+)\\s*${RANGE}\\s*L?(\\d+)\\b`, "g"), "Lessons $1 to $2")
      .replace(/\bL(\d+)\/L?(\d+)\b/g, "Lesson $1 or $2")
      .replace(new RegExp(`§\\s*(\\d+)\\s*${RANGE}\\s*§?\\s*(\\d+)`, "g"), "sections $1 to $2")
      // "John 3:1-21" and "1 John 4:1(en dash)2", then the single verse.
      .replace(new RegExp(`(\\d+):(\\d+)${RANGE}(\\d+)`, "g"), "$1, verses $2 to $3")
      .replace(/(\d+):(\d+)/g, "$1, verse $2")
      // Any range left: "pp. 23(en dash)24", "Lessons 30(en dash)33".
      .replace(new RegExp(`(\\d)${EN_DASH}(\\d)`, "g"), "$1 to $2")
      .replace(/\bpp\.\s*/g, "pages ")
      // "p. 23" is a page too; alone, the letter is read out as a letter.
      .replace(/\bp\.\s*(?=\d)/g, "page ")
      .replace(/~\s*(\d+)\s*min\b/g, "about $1 minutes")
      .replace(/~\s*(?=\d)/g, "about ")
      // An editorial bracket inside a quotation, "judge[s]", is read as the word.
      .replace(/\[([a-z]+)\]/g, "$1")
      // A fill-in blank, a spelled-out sum ("Authority = Accountability +
      // Responsibility") and a slash are all read out as the name of the mark.
      // A spaced slash separates two phrases; an unspaced one offers two words.
      .replace(/_{3,}/g, "blank")
      .replace(/ = /g, " equals ")
      .replace(/ \+ /g, " plus ")
      .replace(/\band\/or\b/g, "and or")
      .replace(/ \/ /g, ", ")
      .replace(/([A-Za-z0-9])\/(?=[A-Za-z])/g, "$1 or ")
      // The authored cross-reference shorthand: "L15" is Lesson 15.
      .replace(/\bL(\d+)\b/g, "Lesson $1")
      .replace(/\bvs\b\.?/g, "versus")
      .replace(/§\s*/g, "section ")
      // Separators that carry a pause on the page and nothing in the audio.
      // `[^\S\n]` is a space that is not a line break: plain `\s` ate the break
      // too and ran two paragraphs into one wherever a line ended on a separator.
      .replace(/[^\S\n]*·[^\S\n]*/g, ". ")
      // An arrow alone on its line is a flow diagram's connector between two
      // boxes: it opens the next step ("Then 2. Does it agree with Scripture?")
      // instead of becoming a paragraph that says only "then".
      .replace(/(^|\n)[^\S\n]*→[^\S\n]*\n/g, "$1Then ")
      .replace(/[^\S\n]*→[^\S\n]*/g, ", then ")
      // After a question the arrow starts a new sentence: "Which channel?, then
      // Lesson 3" has no sentence end for the voice to fall on.
      .replace(/([?!.]), then /g, "$1 Then ")
      // An en dash still standing joins two words ("the Samuel(en dash)Saul
      // passage"), which is a hyphen's job and a mark the model knows.
      .replace(new RegExp(EN_DASH, "g"), "-")
      // A non-breaking hyphen is a hyphen to a reader.
      .replace(/‑/g, "-")
      // A separator at the start or end of a line leaves a stray mark behind.
      .split("\n")
      .map((line) =>
        line
          .replace(/^[.,]\s+/, "")
          // A separator after a sentence that had already ended doubles its full
          // stop ('speak".. Lesson 1'), anywhere in the line. A real ellipsis is
          // three dots or its own character, so it is left alone.
          .replace(/(?<!\.)\.\s*\.(?!\.)/g, ".")
          .replace(/([?!:;,])\.(?=\s|$)/g, "$1")
          .trim(),
      )
      .filter((line) => line.length > 0)
      .join("\n")
  );
}
