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
  return s.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (raw, e: string) => ENTITIES[e] ?? raw);
}

/**
 * The narration script for a Lesson body: its prose, with quiz cards and markup
 * removed and block boundaries turned into paragraph breaks.
 */
export function narrationFromHtml(html: string): string {
  let s = html;
  s = dropElements(s, /<script\b[^>]*>/, "script");
  s = dropElements(s, /<style\b[^>]*>/, "style");
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

/**
 * The first `limit` characters of a narration script, cut where a reader would
 * stop rather than mid-word.
 *
 * This exists for the free-tier audition. ElevenLabs' free plan allows 10,000
 * characters a MONTH, and one prophetic-school lesson is around 7,300, so
 * rendering a whole lesson just to find out whether you like a voice spends most
 * of the month on the first try and makes comparing two voices impossible. A
 * 600-character sample costs 6% of it instead.
 *
 * The cut walks backwards from the limit: the end of the last complete sentence,
 * failing that a paragraph break, failing that the last space. Each fallback is
 * only taken if it leaves a reasonable amount of text, so a stray early full stop
 * cannot collapse a 600-character sample into eight words. A hard slice is the
 * last resort, because a clipped word beats returning nothing.
 *
 * `limit <= 0` means no sampling at all: the whole script, which is the default.
 */
export function sampleOf(text: string, limit: number): string {
  if (limit <= 0 || text.length <= limit) return text;
  const head = text.slice(0, limit);
  // Enough of the budget used that the cut is a sample rather than a fragment.
  const enough = limit * 0.4;
  // Greedy, so this matches up to the LAST sentence-ending mark in `head`.
  const sentence = head.match(/[\s\S]*[.!?](?=\s|$)/);
  if (sentence && sentence[0].length > enough) return sentence[0].trim();
  const para = head.lastIndexOf("\n");
  if (para > enough) return head.slice(0, para).trim();
  const space = head.lastIndexOf(" ");
  return (space > 0 ? head.slice(0, space) : head).trim();
}
