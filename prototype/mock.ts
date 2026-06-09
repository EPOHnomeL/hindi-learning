// THROWAWAY mock data for the reader prototype. Mirrors CONTEXT.md vocabulary
// (Topic, Lesson, Reference, Question, Reply, Progress) but is NOT the real
// schema — no Neon, no R2. Just enough to feel the reader experience.

export type ProgressState = "unseen" | "opened" | "completed";

export interface QuizPrompt {
  promptId: string;
  question: string;
  options: { key: string; label: string }[];
  correct: string;
  explain: string;
}

export interface Lesson {
  id: string;
  order: number;
  title: string;
  oneLiner: string;
  /** Self-contained lesson body (what teach would emit as an HTML blob). */
  bodyHtml: string;
  quiz: QuizPrompt;
}

export interface Reference {
  id: string;
  title: string;
  blurb: string;
  bodyHtml: string;
}

export interface Question {
  id: string;
  lessonId: string;
  text: string;
  reply?: string; // open while undefined; answered once a Reply exists
}

export interface Topic {
  id: string;
  title: string;
  mission: string;
}

export const topic: Topic = {
  id: "hindi",
  title: "Hindi — from the Bible",
  mission:
    "Read the Gospels in Hindi well enough to follow a sermon at my church, grounding every lesson in verses I already know in English.",
};

export const lessons: Lesson[] = [
  {
    id: "0001-peace-be-with-you",
    order: 1,
    title: "शान्ति — “Peace be with you”",
    oneLiner: "Your first word, straight from John 20:19.",
    bodyHtml: `
      <p class="verse">“…यीशु आकर बीच में खड़ा हुआ और उनसे कहा, <strong>तुम्हें शान्ति मिले।</strong>”
      <span class="cite">— यूहन्ना 20:19 (John 20:19)</span></p>
      <p>The word <span class="dev">शान्ति</span> <em>(śānti)</em> means <strong>peace</strong> — not just
      the absence of conflict, but wholeness and calm. You will hear it constantly: in greetings,
      in blessings, and all through the Gospels.</p>
      <h3>Break it down</h3>
      <ul>
        <li><span class="dev">शा</span> — <em>śā</em> (like “shah”)</li>
        <li><span class="dev">न्ति</span> — <em>nti</em> (a soft “n” into “tee”)</li>
      </ul>
      <p>Say it slowly: <em>SHAAN-tee</em>. Now the whole blessing: <span class="dev">तुम्हें शान्ति मिले</span>
      <em>(tumhें śānti mile)</em> — “may you receive peace.”</p>
      <p class="aside">📖 You already know this verse in English — that's the point. New language,
      familiar ground.</p>`,
    quiz: {
      promptId: "q1",
      question: "What does शान्ति (śānti) mean?",
      options: [
        { key: "a", label: "Light" },
        { key: "b", label: "Peace" },
        { key: "c", label: "Bread" },
        { key: "d", label: "Father" },
      ],
      correct: "b",
      explain: "शान्ति means peace — wholeness and calm. It opens John 20:19.",
    },
  },
  {
    id: "0002-light-of-the-world",
    order: 2,
    title: "ज्योति — “the Light”",
    oneLiner: "From John 8:12, “I am the light of the world.”",
    bodyHtml: `
      <p class="verse">“मैं जगत की <strong>ज्योति</strong> हूँ।” <span class="cite">— यूहन्ना 8:12 (John 8:12)</span></p>
      <p>The word <span class="dev">ज्योति</span> <em>(jyoti)</em> means <strong>light</strong>.
      Hear the bright “j” at the front: <em>JYO-tee</em>.</p>
      <p class="aside">📖 Pair it with what you learned last time — शान्ति and ज्योति, peace and light.</p>`,
    quiz: {
      promptId: "q1",
      question: "ज्योति (jyoti) means…",
      options: [
        { key: "a", label: "Peace" },
        { key: "b", label: "Water" },
        { key: "c", label: "Light" },
        { key: "d", label: "Road" },
      ],
      correct: "c",
      explain: "ज्योति means light — “I am the light of the world.”",
    },
  },
  {
    id: "0003-the-word",
    order: 3,
    title: "वचन — “the Word”",
    oneLiner: "The opening of John 1:1.",
    bodyHtml: `
      <p class="verse">“आदि में <strong>वचन</strong> था…” <span class="cite">— यूहन्ना 1:1 (John 1:1)</span></p>
      <p>The word <span class="dev">वचन</span> <em>(vacan)</em> means <strong>word</strong> — as in
      “the Word.” Say <em>VUH-chun</em>.</p>`,
    quiz: {
      promptId: "q1",
      question: "वचन (vacan) means…",
      options: [
        { key: "a", label: "Word" },
        { key: "b", label: "Peace" },
        { key: "c", label: "Light" },
        { key: "d", label: "Mountain" },
      ],
      correct: "a",
      explain: "वचन means word — “In the beginning was the Word.”",
    },
  },
];

export const references: Reference[] = [
  {
    id: "ref-core-words",
    title: "Core words so far",
    blurb: "The handful of words you've met, for quick review.",
    bodyHtml: `
      <table class="ref-table">
        <tr><th>Hindi</th><th>Sounds like</th><th>Meaning</th><th>Verse</th></tr>
        <tr><td class="dev">शान्ति</td><td>śānti</td><td>peace</td><td>John 20:19</td></tr>
        <tr><td class="dev">ज्योति</td><td>jyoti</td><td>light</td><td>John 8:12</td></tr>
        <tr><td class="dev">वचन</td><td>vacan</td><td>word</td><td>John 1:1</td></tr>
      </table>`,
  },
  {
    id: "ref-devanagari-vowels",
    title: "Devanāgarī vowels (cheat-sheet)",
    blurb: "The vowel signs you'll keep bumping into.",
    bodyHtml: `
      <p>Independent vowels, the ones that start a word:</p>
      <p class="vowel-row"><span class="dev">अ आ इ ई उ ऊ ए ऐ ओ औ</span></p>
      <p><em>a ā i ī u ū e ai o au</em> — long marks (ā, ī, ū) just mean “hold it longer.”</p>`,
  },
];

export const seedQuestions: Question[] = [
  {
    id: "qn-1",
    lessonId: "0001-peace-be-with-you",
    text: "Is शान्ति ever used as a name? I think I've heard “Shanti” as a person's name.",
    reply:
      "Yes — Shanti (शान्ति) is a common given name precisely because it means peace. In the verse it's the noun, but you'll meet it as a name too.",
  },
  {
    id: "qn-2",
    lessonId: "0002-light-of-the-world",
    text: "Why does ज्योति start with that 'jy' cluster? Hard to say.",
  },
];

export const seedProgress: Record<string, ProgressState> = {
  "0001-peace-be-with-you": "completed",
  "0002-light-of-the-world": "opened",
  "0003-the-word": "unseen",
};
