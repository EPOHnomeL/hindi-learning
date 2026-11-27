import { describe, expect, it } from "vitest";
import { narrationFromHtml, speakable } from "./narrationText";

// A lesson body shaped like a real one: the authored `<head>` with its stylesheet,
// prose, and an MCQ quiz card matching the authoring contract (see
// `convex/quizShuffle.test.ts` for the same block).
const lesson = `<!doctype html>
<html><head><title>Hearing God</title>
<style>body { font-family: serif; } .quiz { background: #eee; }</style>
</head>
<body>
<h1>Hearing God</h1>
<p>Prophecy begins with <strong>listening</strong>, not speaking.</p>
<div class="quiz" data-correct="b" data-ok="yes" data-no="no">
  <div class="q">1. What comes first?</div>
  <div class="opts">
    <button class="opt" data-k="a">Speaking</button>
    <button class="opt" data-k="b">Listening</button>
  </div>
  <div class="fb"></div>
</div>
<p>Practise this daily.</p>
<script>console.log("bridge")</script>
</body></html>`;

describe("narrationFromHtml", () => {
  it("keeps the prose and the headings, in order", () => {
    expect(narrationFromHtml(lesson)).toBe(
      ["Hearing God", "Prophecy begins with listening, not speaking.", "Practise this daily."].join("\n"),
    );
  });

  it("does not say the lesson's name twice", () => {
    // The document `<title>` repeats the `<h1>`. Narrated, every lesson opened
    // with its own name said two times over (heard 2026-11-24).
    expect(narrationFromHtml(lesson).match(/Hearing God/g)).toHaveLength(1);
  });

  it("decodes typographic entities instead of spelling them out", () => {
    // prophetic-school carries a literal `&ndash;` in eight places, which a
    // narrator read as "and n dash". Codepoints, so this file stays plain ASCII.
    const ch = (cp: number) => String.fromCharCode(cp);
    expect(narrationFromHtml("<p>pp. 23&ndash;24 &mdash; wait&hellip;</p>")).toBe(
      `pp. 23${ch(0x2013)}24 ${ch(0x2014)} wait${ch(0x2026)}`,
    );
    expect(narrationFromHtml("<p>&lsquo;a&rsquo; &ldquo;b&rdquo;</p>")).toBe(
      `${ch(0x2018)}a${ch(0x2019)} ${ch(0x201c)}b${ch(0x201d)}`,
    );
  });

  it("drops the whole quiz card, not just its opening div", () => {
    const out = narrationFromHtml(lesson);
    // The trap: a lazy regex stops at the first `</div>` and leaves the options
    // and feedback behind, so the narrator reads the answers aloud.
    expect(out).not.toContain("What comes first");
    expect(out).not.toContain("Speaking");
    expect(out).not.toContain("Listening,"); // the option, not the word in the prose
  });

  it("never speaks script or style contents", () => {
    const out = narrationFromHtml(lesson);
    expect(out).not.toContain("font-family");
    expect(out).not.toContain("console.log");
  });

  it("decodes the entities that reach plain prose", () => {
    expect(narrationFromHtml("<p>Law &amp; Prophets &nbsp;&quot;listen&quot;</p>")).toBe('Law & Prophets "listen"');
  });

  it("does not split a sentence on inline markup", () => {
    expect(narrationFromHtml("<p>He <em>said</em> it <a href='#'>plainly</a>.</p>")).toBe("He said it plainly.");
  });

  it("breaks paragraphs so the voice pauses where the page does", () => {
    expect(narrationFromHtml("<h2>One</h2><p>Two</p><li>Three</li>")).toBe("One\nTwo\nThree");
  });

  it("drops a quiz card even when its class carries other tokens", () => {
    expect(narrationFromHtml(`<p>Keep</p><div class="card quiz fill" data-answer="x"><p>Drop</p></div>`)).toBe("Keep");
  });

  it("drops the tail rather than half a card when markup is unbalanced", () => {
    expect(narrationFromHtml(`<p>Keep</p><div class="quiz"><p>Drop</p>`)).toBe("Keep");
  });

  it("is empty, not a crash, for an empty body", () => {
    expect(narrationFromHtml("")).toBe("");
  });
});

// ---- speakable: spelling the script the way it is said ---------------------

describe("speakable", () => {
  // Built from codepoints so the test file itself carries none of the marks.
  const EN = String.fromCharCode(0x2013);
  const DOT = String.fromCharCode(0x00b7);
  const ARROW = String.fromCharCode(0x2192);
  const SECTION = String.fromCharCode(0x00a7);
  const NB_HYPHEN = String.fromCharCode(0x2011);

  it("reads chapter and verse as chapter and verse", () => {
    // Left alone, the model says "sixteen thirteen".
    expect(speakable("John 16:13")).toBe("John 16, verse 13");
  });

  it("reads a verse range, hyphen or en dash", () => {
    expect(speakable("John 3:1-21")).toBe("John 3, verses 1 to 21");
    expect(speakable(`1 John 4:1${EN}2`)).toBe("1 John 4, verses 1 to 2");
  });

  it("reads any other en dash number range as 'to'", () => {
    expect(speakable(`Lessons 30${EN}33`)).toBe("Lessons 30 to 33");
  });

  it("leaves a hyphen between numbers that is not a verse range", () => {
    // Only the en dash is unambiguous outside a reference: a phone number and
    // "2-3 minutes" both use a hyphen.
    expect(speakable("call 555-0100")).toBe("call 555-0100");
  });

  it("says page and pages", () => {
    expect(speakable(`(pp. 23${EN}24)`)).toBe("(pages 23 to 24)");
    expect(speakable("(p. 23)")).toBe("(page 23)");
    // Not every "p." is a page.
    expect(speakable("Add 3 tsp. of salt")).toBe("Add 3 tsp. of salt");
  });

  it("says the authored shorthand in words", () => {
    expect(speakable("~10 min")).toBe("about 10 minutes");
    expect(speakable("see L15")).toBe("see Lesson 15");
    expect(speakable("faith vs fear, faith vs. fear")).toBe("faith versus fear, faith versus fear");
    expect(speakable(`${SECTION} 4`)).toBe("section 4");
    expect(speakable(`well${NB_HYPHEN}known`)).toBe("well-known");
  });

  it("says the marks the model would otherwise name", () => {
    expect(speakable("give yourself ~60 to 90 seconds")).toBe("give yourself about 60 to 90 seconds");
    expect(speakable('the recipient "judge[s] the word"')).toBe('the recipient "judges the word"');
    expect(speakable("how I hear: ___")).toBe("how I hear: blank");
    expect(speakable("Authority = Accountability + Responsibility")).toBe(
      "Authority equals Accountability plus Responsibility",
    );
    expect(speakable("your Holy Spirit / prophetic-school course")).toBe("your Holy Spirit, prophetic-school course");
    expect(speakable("learning and/or teaching, Lesson 7/Lesson 1")).toBe(
      "learning and or teaching, Lesson 7 or Lesson 1",
    );
  });

  it("reads a pair of lesson or section references as one range", () => {
    // All from the pulled course: the generic range rule needs a digit on both
    // sides of the dash, so these kept their dash or slash until 2026-11-24.
    expect(speakable(`(L16${EN}L19)`)).toBe("(Lessons 16 to 19)");
    expect(speakable(`L30${EN}33`)).toBe("Lessons 30 to 33");
    expect(speakable("L6/18 (a building-up word)")).toBe("Lesson 6 or 18 (a building-up word)");
    expect(speakable("L7/L1")).toBe("Lesson 7 or 1");
    expect(speakable(`${SECTION}3${EN}${SECTION}4 and ${SECTION} 1${EN}6`)).toBe("sections 3 to 4 and sections 1 to 6");
  });

  it("leaves no en dash for the model to drop", () => {
    expect(speakable(`the Samuel${EN}Saul passage`)).toBe("the Samuel-Saul passage");
  });

  it("starts a new sentence when an arrow follows a question", () => {
    expect(speakable(`Which channel? ${ARROW} L3`)).toBe("Which channel? Then Lesson 3");
    expect(speakable(`Self at centre? ${ARROW} soul`)).toBe("Self at centre? Then soul");
  });

  it("does not expand a word that merely contains the shorthand", () => {
    expect(speakable("canvas, LED, XL15")).toBe("canvas, LED, XL15");
  });

  it("turns a middle dot into a pause and an arrow into 'then'", () => {
    // Both are dropped silently by the model, which runs the phrases together.
    expect(speakable(`Lesson 1 ${DOT} Hearing God`)).toBe("Lesson 1. Hearing God");
    expect(speakable(`Listen ${ARROW} test ${ARROW} act`)).toBe("Listen, then test, then act");
  });

  it("does not double a full stop when the separator follows a finished sentence", () => {
    // Fifty lessons end their source note with a sentence, then a middle dot.
    expect(speakable(`"Ways God can speak". ${DOT} Lesson 1`)).toBe('"Ways God can speak". Lesson 1');
    expect(speakable(`(p. 23). ${DOT} Lesson 4`)).toBe("(page 23). Lesson 4");
    expect(speakable(`Is it Him? ${DOT} Lesson 2`)).toBe("Is it Him? Lesson 2");
  });

  it("leaves a real ellipsis alone", () => {
    expect(speakable("Wait... and listen.")).toBe("Wait... and listen.");
  });

  it("drops a separator stranded at either end of a line", () => {
    expect(speakable(`${DOT} Scripture\nJohn 16:13 ${DOT}`)).toBe("Scripture\nJohn 16, verse 13.");
  });

  it("keeps one paragraph per line and drops a line that was only a separator", () => {
    // The trap this pins: `\s*` around the separator also matched the line
    // break, so "One / (dot) / Two" came out as the single paragraph "One. Two".
    expect(speakable(`One\n${DOT}\nTwo`)).toBe("One\nTwo");
    expect(speakable(`One ${DOT}\nTwo`)).toBe("One.\nTwo");
  });

  it("reads an arrow on a line of its own as the start of the next step", () => {
    // A flow diagram: three boxes with a connector element between each.
    expect(speakable(`1. Honours Jesus?\n${ARROW}\n2. Fits Scripture?`)).toBe(
      "1. Honours Jesus?\nThen 2. Fits Scripture?",
    );
  });
});

// growing-unto-glory, 2026-11-25: its section headings carry no space between the
// number span and the words, so stripping the tags read "1Glory as inheritance".
describe("narrationFromHtml section numbers", () => {
  it("keeps a section number apart from a heading written without a space", () => {
    expect(narrationFromHtml('<h2><span class="num">1</span>Glory as inheritance</h2>')).toBe(
      "1 Glory as inheritance",
    );
  });

  it("leaves a heading that already had the space exactly as it was", () => {
    expect(narrationFromHtml('<h2><span class="num">1</span> You were made to hear</h2>')).toBe(
      "1 You were made to hear",
    );
  });
});

describe("speakable book abbreviations", () => {
  it("names Revelation, Psalm and Joshua when abbreviated before a chapter", () => {
    expect(speakable("Rev 2:7, Ps 110:1 and Josh 6:1")).toBe(
      "Revelation 2, verse 7, Psalm 110, verse 1 and Joshua 6, verse 1",
    );
  });

  it("leaves the words rev, ps and josh alone when no chapter follows", () => {
    expect(speakable("Rev up. PS. Josh said")).toBe("Rev up. PS. Josh said");
  });
});

describe("speakable in Hindi", () => {
  it("says chapter and verse, ranges, pages, dots and arrows in Hindi", () => {
    const dash = String.fromCharCode(0x2013);
    expect(speakable(`यूहन्ना 5:19 · पृ. 23${dash}24`, "hi")).toBe("यूहन्ना 5, पद 19। पृष्ठ 23 से 24");
    expect(speakable("1 कुरिन्थियों 14:1-3", "hi")).toBe("1 कुरिन्थियों 14, पद 1 से 3");
    expect(speakable("Holy Spirit Course · p. 23", "hi")).toBe("Holy Spirit Course। पृष्ठ 23");
    expect(speakable("सुनो → लिखो", "hi")).toBe("सुनो, फिर लिखो");
    expect(speakable("~10 min", "hi")).toBe("लगभग 10 मिनट");
    expect(speakable("पाठ समाप्त। · अगला", "hi")).toBe("पाठ समाप्त। अगला");
  });

  it("leaves English on the English rules", () => {
    expect(speakable("John 5:19", "en")).toBe(speakable("John 5:19"));
    expect(speakable("John 5:19")).toBe("John 5, verse 19");
  });
});
