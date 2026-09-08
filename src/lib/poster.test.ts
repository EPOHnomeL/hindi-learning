import { describe, expect, it } from "vitest";
import { posterModel, priceLabel, titleLen, type PosterCourse, type PosterEdits, type PosterTenant } from "./poster";

// The poster model (course-poster spec, Testing Decisions): drive the seam with
// real inputs and assert what comes out. No class names, no pixels.

// A stub for the `Poster` chrome: the key back, with any values appended, so a
// test can see which copy was chosen without caring how it is worded.
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(",")})` : key;

const ywam: PosterTenant = {
  displayName: "YWAM Potch",
  motto: "Youth with a Mission, South Africa",
  theme: { light: { paper: "#f9f4ea", card: "#fffdf8", soft: "#6a7290", accent: "#1b2a80", accent2: "#3a52a8", gold: "#d8a93f", hi: "#e7ebf7" } },
  logoUrl: "https://storage.example/mark.png",
  flags: { certificates: true },
};

const course: PosterCourse = {
  title: "Growing your relationship with the Holy Spirit",
  mission: "A living, day-to-day walk with Him.",
  lang: "en",
  lessons: Array.from({ length: 56 }, (_, i) => ({ key: `${i}` })),
  paywall: { amount: 10000, currency: "ZAR", previewKey: "0001-a" },
  languages: [
    { lang: "af", native: "Afrikaans" },
    { lang: "en", native: "English" },
    { lang: "es", native: "Español" },
    { lang: "ur", native: "اردو" },
  ],
};

const noEdits: PosterEdits = { highlights: [], emphasis: null, tagline: null };
const shareUrl = "https://ywampotch.my-course.app/share/tok-en";

const model = (over: Partial<PosterCourse> = {}, tenant: PosterTenant = ywam, edits: PosterEdits = noEdits) =>
  posterModel({ course: { ...course, ...over }, tenant, edits, shareUrl }, t);

describe("posterModel", () => {
  it("a paid Edition gets the paid eyebrow and a formatted price", () => {
    const m = model();
    expect(m.eyebrow).toBe("eyebrowPaid");
    expect(m.price).toEqual({ label: priceLabel(10000, "ZAR", "en"), suffix: "priceSuffix" });
    expect(m.price!.label).toMatch(/^R\s?100$/);
  });

  it("a free Edition gets the free eyebrow and no price block", () => {
    const m = model({ paywall: undefined });
    expect(m.eyebrow).toBe("eyebrowFree");
    expect(m.price).toBeNull();
  });

  it("two highlights plus the facts make exactly three points, highlights first", () => {
    const m = model({}, ywam, { ...noEdits, highlights: ["Hear God's voice", " Grow in the gifts ", ""] });
    expect(m.points).toEqual(["Hear God's voice", "Grow in the gifts", "lessons(56)"]);
  });

  it("with no highlights the facts fill the list, and the certificate fact obeys the tenant flag", () => {
    expect(model().points).toEqual(["lessons(56)", "certificate", "offline"]);
    expect(model({}, { ...ywam, flags: { certificates: false } }).points).toEqual(["lessons(56)", "offline"]);
    // A course with no lessons yet makes no lesson claim.
    expect(model({ lessons: [] }).points).toEqual(["certificate", "offline"]);
  });

  it("sizes the title by length", () => {
    expect(titleLen("Hindi")).toBe("");
    expect(titleLen("Growing your relationship with the Holy Spirit")).toBe("long");
    expect(titleLen("A sixty character title that goes on and on and on and on ok")).toBe("xlong");
    expect(model({ title: "A sixty character title that goes on and on and on and on ok" }).titleLen).toBe("xlong");
  });

  it("splits the title around the owner's emphasis and ignores an empty or out-of-range run", () => {
    const title = "Growing your relationship with the Holy Spirit";
    const start = title.indexOf("Holy Spirit");
    expect(model({}, ywam, { ...noEdits, emphasis: { start, end: start + 11 } }).title).toEqual({
      before: "Growing your relationship with the ",
      em: "Holy Spirit",
      after: "",
    });
    expect(model({}, ywam, { ...noEdits, emphasis: { start: 5, end: 5 } }).title).toEqual({ before: title, em: "", after: "" });
    expect(model({}, ywam, { ...noEdits, emphasis: { start: 40, end: 999 } }).title.em).toBe("Spirit");
    expect(model().title).toEqual({ before: title, em: "", after: "" });
  });

  it("counts the live Editions, names this Edition and English first, and says how many more", () => {
    expect(model().langs).toEqual({ count: 4, named: ["English", "Afrikaans"], more: 2 });
    expect(model({ lang: "ur" }).langs).toEqual({ count: 4, named: ["اردو", "English"], more: 2 });
    expect(model({ languages: [{ lang: "en", native: "English" }] }).langs).toEqual({ count: 1, named: ["English"], more: 0 });
    expect(model({ languages: [] }).langs).toBeNull();
  });

  it("an RTL Edition is rtl in the Arabic script face; Hindi is Devanagari; romanised Hindi is Latin", () => {
    expect(model({ lang: "ur" })).toMatchObject({ dir: "rtl", script: "arab", locale: "ur" });
    expect(model({ lang: "hi" })).toMatchObject({ dir: "ltr", script: "deva", locale: "hi" });
    expect(model({ lang: "hi-Latn" })).toMatchObject({ dir: "ltr", script: "latn", locale: "en" });
  });

  it("an Edition language without shipped chrome gets English chrome", () => {
    expect(model({ lang: "te" }).locale).toBe("en");
    expect(model({ lang: "af" }).locale).toBe("af");
  });

  it("a mission that is a document rather than a line is not a tagline", () => {
    // prophetic-school's real mission (2026-09-07): Markdown headings, bullets,
    // several paragraphs. That is the course's brief, not a sentence for a wall.
    const doc = [
      "# Mission: Growing in the Holy Spirit",
      "",
      "## Why",
      "I want a living, day-to-day walk with the Holy Spirit.",
      "",
      "## Success looks like",
      "- I sit down to listen",
    ].join("\n");
    expect(model({ mission: doc }).tagline).toBeNull();
    expect(model({ mission: "Read *Premchand* in the original." }).tagline).toBeNull();
    expect(model({ mission: "A".repeat(161) }).tagline).toBeNull();
    expect(model({ mission: "  A living, day-to-day walk with Him.  " }).tagline).toBe("A living, day-to-day walk with Him.");
    // The owner can still supply one for this render.
    expect(model({ mission: doc }, ywam, { ...noEdits, tagline: "Walk with Him." }).tagline).toBe("Walk with Him.");
  });

  it("the owner's tagline overrides the mission for this render only; blank falls back", () => {
    expect(model().tagline).toBe("A living, day-to-day walk with Him.");
    expect(model({}, ywam, { ...noEdits, tagline: "  Walk with Him.  " }).tagline).toBe("Walk with Him.");
    expect(model({}, ywam, { ...noEdits, tagline: "   " }).tagline).toBe("A living, day-to-day walk with Him.");
    expect(model({ mission: null }).tagline).toBeNull();
  });

  it("maps the tenant's tokens onto the sheet and carries its brand", () => {
    const m = model();
    expect(m.palette).toEqual({
      cream: "#f9f4ea", cream2: "#e7ebf7", navy: "#1b2a80", navy2: "#3a52a8", gold: "#d8a93f", slate: "#6a7290", card: "#fffdf8",
    });
    expect(m).toMatchObject({ logoUrl: "https://storage.example/mark.png", tenantName: "YWAM Potch", tenantMotto: "Youth with a Mission, South Africa" });
    // A tenant without a logo gets no image; the page sets the name as a wordmark.
    expect(model({}, { ...ywam, logoUrl: null, motto: null })).toMatchObject({ logoUrl: null, tenantMotto: null });
  });

  it("the default site gets the app's own mark, name and palette", () => {
    const m = model({}, null);
    expect(m).toMatchObject({ logoUrl: "/icon.svg", tenantName: "My Course", tenantMotto: null });
    expect(m.palette.cream).toBe("#fbf7f0");
    expect(m.palette.navy).toBe("#9c5b34");
    // No tenant means no flag to refuse with: the certificate fact stands.
    expect(m.points).toContain("certificate");
  });

  it("prints the host of the canonical public URL and keeps the URL for the QR", () => {
    const m = model();
    expect(m.host).toBe("ywampotch.my-course.app");
    expect(m.shareUrl).toBe(shareUrl);
  });
});

describe("priceLabel", () => {
  it("prints whole units when there are no cents and two decimals otherwise", () => {
    expect(priceLabel(10000, "zar", "en")).toMatch(/^R\s?100$/);
    expect(priceLabel(1250, "USD", "en")).toBe("$12.50");
  });

  it("falls back to a plain amount for a currency Intl refuses", () => {
    expect(priceLabel(10000, "NOTREAL", "en")).toBe("100 NOTREAL");
  });
});
