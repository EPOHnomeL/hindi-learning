import { describe, expect, it } from "vitest";
import {
  cardIdFromHash,
  composeCardShare,
  completedKeys,
  courseIndexRedirect,
  firstLessonKey,
  frontierKey,
  internalNavTarget,
  nextLessonKey,
  resolveArtifactClick,
  resourceOpenMode,
  resourceTarget,
  resumeLessonKey,
  seenAfterOpening,
  unseenReplyKeys,
} from "./readerDerive";

describe("courseIndexRedirect", () => {
  it("carries purchase/mp through to the lesson URL — the payment-return banner depends on it", () => {
    expect(courseIndexRedirect("/courses/hindi/lessons/0001", "purchase=return&mp=tok1", null)).toBe(
      "/courses/hindi/lessons/0001?purchase=return&mp=tok1",
    );
  });

  it("sets lang from the resolved Edition, replacing any lang in the URL", () => {
    // The Edition can come from localStorage (no lang in the URL) — set fresh.
    expect(courseIndexRedirect("/courses/hindi/lessons/0001", "purchase=return&mp=t", "ur")).toBe(
      "/courses/hindi/lessons/0001?purchase=return&mp=t&lang=ur",
    );
    // A lang already in the URL is replaced, never duplicated.
    expect(courseIndexRedirect("/courses/hindi/lessons/0001", "lang=es&purchase=return&mp=t", "ur")).toBe(
      "/courses/hindi/lessons/0001?purchase=return&mp=t&lang=ur",
    );
  });

  it("no resolved Edition carries no lang param", () => {
    expect(courseIndexRedirect("/courses/hindi/lessons/0001", "", null)).toBe("/courses/hindi/lessons/0001");
  });

  it("an explicit English Edition is preserved, never stripped", () => {
    // Regression (prod bug): a buyer pinned to the paid English Edition
    // (`?lang=en` from the buy funnel or a catalogue card) must stay on it.
    // Stripping "en" here left the request implicit, and the resolver then fell
    // back to any free published Edition (the Finnish one) — no paygate, no buy.
    expect(courseIndexRedirect("/courses/hindi/lessons/0001", "lang=en", "en")).toBe(
      "/courses/hindi/lessons/0001?lang=en",
    );
    // …and alongside the other params the redirect carries. (This case read
    // `buy=1` until checkout became its own route and the marker was deleted.)
    expect(courseIndexRedirect("/courses/hindi/lessons/0001", "purchase=return&lang=en", "en")).toBe(
      "/courses/hindi/lessons/0001?purchase=return&lang=en",
    );
  });
});

describe("internalNavTarget", () => {
  it("passes an owner/viewer course link through unchanged", () => {
    expect(internalNavTarget("/courses/biz/lessons/0001-x", "/courses/biz/lessons/0004-y")).toBe(
      "/courses/biz/lessons/0001-x",
    );
  });

  it("remaps a cross-lesson link into the share context for a Guest", () => {
    expect(internalNavTarget("/courses/biz/lessons/0001-x", "/share/tok123/lessons/0004-y")).toBe(
      "/share/tok123/lessons/0001-x",
    );
  });

  it("remaps a reference link into the share context too", () => {
    expect(internalNavTarget("/courses/biz/references/ref-1", "/share/tok123/lessons/0004-y")).toBe(
      "/share/tok123/references/ref-1",
    );
  });

  it("leaves a non-artifact same-origin path alone even in a share context", () => {
    expect(internalNavTarget("/Handbook.pdf", "/share/tok123/lessons/0004-y")).toBe("/Handbook.pdf");
  });
});

describe("resolveArtifactClick", () => {
  it("classifies a Resource link into a resource action carrying the id", () => {
    expect(resolveArtifactClick("/courses/biz/resources/r7c2ab", "/courses/biz/lessons/0001-x")).toEqual({
      kind: "resource",
      id: "r7c2ab",
    });
  });

  it("resolves a Resource link the same way regardless of reader context (a Guest too)", () => {
    // The lesson authors the owner's /courses route; a Resource is opened by id,
    // not navigated, so the /share context never rewrites it.
    expect(resolveArtifactClick("/courses/biz/resources/r7c2ab", "/share/tok123/lessons/0004-y")).toEqual({
      kind: "resource",
      id: "r7c2ab",
    });
  });

  it("classifies a cross-lesson link into a navigate action, unchanged for the owner", () => {
    expect(resolveArtifactClick("/courses/biz/lessons/0001-x", "/courses/biz/lessons/0004-y")).toEqual({
      kind: "navigate",
      path: "/courses/biz/lessons/0001-x",
    });
  });

  it("navigate actions still carry the Guest share rewrite (lessons and references)", () => {
    expect(resolveArtifactClick("/courses/biz/lessons/0001-x", "/share/tok123/lessons/0004-y")).toEqual({
      kind: "navigate",
      path: "/share/tok123/lessons/0001-x",
    });
    expect(resolveArtifactClick("/courses/biz/references/ref-1", "/share/tok123/lessons/0004-y")).toEqual({
      kind: "navigate",
      path: "/share/tok123/references/ref-1",
    });
  });

  it("passes a non-artifact path through as a navigate action", () => {
    expect(resolveArtifactClick("/Handbook.pdf", "/share/tok123/lessons/0004-y")).toEqual({
      kind: "navigate",
      path: "/Handbook.pdf",
    });
  });
});

describe("resourceOpenMode", () => {
  it("opens an uploaded Markdown file in the in-app dialog", () => {
    expect(resourceOpenMode("notes.md", "file")).toBe("dialog");
    expect(resourceOpenMode("READ.markdown", "file")).toBe("dialog");
  });

  it("opens a PDF or any other file in a new tab", () => {
    expect(resourceOpenMode("Handbook.pdf", "file")).toBe("tab");
    expect(resourceOpenMode("poster.png", "file")).toBe("tab");
  });

  it("opens an external URL Resource in a new tab, even one ending .md", () => {
    // A `url` Resource is a link to open, never our Markdown dialog.
    expect(resourceOpenMode("https://example.com/readme.md", "url")).toBe("tab");
  });
});

describe("resourceTarget", () => {
  const bundle = [
    { id: "r_md", filename: "notes.md", kind: "file" as const, url: "https://blob/notes" },
    { id: "r_pdf", filename: "Handbook.pdf", kind: "file" as const, url: "https://blob/handbook" },
    { id: "r_link", filename: "https://example.com/x", kind: "url" as const, url: "https://example.com/x" },
    { id: "r_pending", filename: "landing.pdf", kind: "file" as const, url: null },
  ];

  it("resolves an in-bundle Markdown Resource to its dialog target", () => {
    expect(resourceTarget(bundle, "r_md")).toEqual({
      mode: "dialog",
      filename: "notes.md",
      url: "https://blob/notes",
    });
  });

  it("resolves a PDF or external-URL Resource to a new-tab target — sidebar parity", () => {
    expect(resourceTarget(bundle, "r_pdf")).toMatchObject({ mode: "tab", url: "https://blob/handbook" });
    expect(resourceTarget(bundle, "r_link")).toMatchObject({ mode: "tab", url: "https://example.com/x" });
  });

  it("no-ops on an id absent from the bundle — a withheld paid Preview or deleted Resource", () => {
    expect(resourceTarget(bundle, "r_withheld")).toBeNull();
  });

  it("no-ops when the reader holds no Resource list at all", () => {
    expect(resourceTarget(undefined, "r_md")).toBeNull();
  });

  it("no-ops on a Resource whose blob URL hasn't landed yet", () => {
    expect(resourceTarget(bundle, "r_pending")).toBeNull();
  });
});

describe("firstLessonKey", () => {
  it("returns the first lesson's key (listLessons is seq-ascending)", () => {
    const lessons = [
      { key: "0001-alpha", seq: 1, title: "Alpha" },
      { key: "0002-beta", seq: 2, title: "Beta" },
    ];
    expect(firstLessonKey(lessons)).toBe("0001-alpha");
  });

  it("returns null when there are no lessons", () => {
    expect(firstLessonKey([])).toBe(null);
  });
});

describe("frontierKey", () => {
  it("returns the last lesson's key (the Frontier — highest seq)", () => {
    const lessons = [
      { key: "0001-alpha", seq: 1, title: "Alpha" },
      { key: "0002-beta", seq: 2, title: "Beta" },
    ];
    expect(frontierKey(lessons)).toBe("0002-beta");
  });

  it("returns null when there are no lessons", () => {
    expect(frontierKey([])).toBe(null);
  });
});

describe("nextLessonKey", () => {
  const lessons = [
    { key: "0001-alpha", seq: 1, title: "Alpha" },
    { key: "0002-beta", seq: 2, title: "Beta" },
    { key: "0003-gamma", seq: 3, title: "Gamma" },
  ];

  it("returns the following lesson's key", () => {
    expect(nextLessonKey(lessons, "0001-alpha")).toBe("0002-beta");
    expect(nextLessonKey(lessons, "0002-beta")).toBe("0003-gamma");
  });

  it("returns null on the last lesson (the Frontier)", () => {
    expect(nextLessonKey(lessons, "0003-gamma")).toBe(null);
  });

  it("returns null when the key isn't found or the list is empty", () => {
    expect(nextLessonKey(lessons, "nope")).toBe(null);
    expect(nextLessonKey([], "0001-alpha")).toBe(null);
  });
});

describe("completedKeys", () => {
  it("collects only the lessonKeys marked completed (not merely opened)", () => {
    const progress = [
      { lessonKey: "0001-alpha", status: "completed" as const },
      { lessonKey: "0002-beta", status: "opened" as const },
      { lessonKey: "0003-gamma", status: "completed" as const },
    ];
    const done = completedKeys(progress);
    expect(done.has("0001-alpha")).toBe(true);
    expect(done.has("0003-gamma")).toBe(true);
    expect(done.has("0002-beta")).toBe(false);
    expect(done.size).toBe(2);
  });
});

describe("resumeLessonKey", () => {
  const lessons = [
    { key: "0001-alpha", seq: 1, title: "Alpha" },
    { key: "0002-beta", seq: 2, title: "Beta" },
    { key: "0003-gamma", seq: 3, title: "Gamma" },
  ];

  it("opens the lesson after the last completed one (resume where they left off)", () => {
    const progress = [{ lessonKey: "0001-alpha", status: "completed" as const }];
    expect(resumeLessonKey(lessons, progress)).toBe("0002-beta");
  });

  it("uses the highest-seq completed lesson, not merely the first found", () => {
    // Completions arrive in any order; the *last* one in seq order is what matters.
    const progress = [
      { lessonKey: "0002-beta", status: "completed" as const },
      { lessonKey: "0001-alpha", status: "completed" as const },
    ];
    expect(resumeLessonKey(lessons, progress)).toBe("0003-gamma");
  });

  it("lands on the final lesson itself when it's the last completed (no successor)", () => {
    const progress = [{ lessonKey: "0003-gamma", status: "completed" as const }];
    expect(resumeLessonKey(lessons, progress)).toBe("0003-gamma");
  });

  it("falls back to lesson 1 when nothing is completed yet", () => {
    expect(resumeLessonKey(lessons, [])).toBe("0001-alpha");
    expect(resumeLessonKey(lessons, [{ lessonKey: "0001-alpha", status: "opened" as const }])).toBe("0001-alpha");
  });

  it("ignores completed keys that aren't among the current lessons", () => {
    // A completion for a superseded/other-edition lesson key must not derail resume.
    const progress = [{ lessonKey: "9999-ghost", status: "completed" as const }];
    expect(resumeLessonKey(lessons, progress)).toBe("0001-alpha");
  });

  it("returns null when there are no lessons", () => {
    expect(resumeLessonKey([], [])).toBe(null);
  });
});

describe("unseenReplyKeys", () => {
  const questions = [
    { id: "q1", lessonKey: "0001-alpha", reply: "Here's the answer." },
    { id: "q2", lessonKey: "0002-beta", reply: null }, // open, no reply yet
    { id: "q3", lessonKey: "0003-gamma", reply: "Another answer." },
  ];

  it("flags lessons whose reply the learner has not yet seen", () => {
    const dots = unseenReplyKeys(questions, new Set());
    expect(dots.has("0001-alpha")).toBe(true);
    expect(dots.has("0003-gamma")).toBe(true);
  });

  it("ignores questions with no reply", () => {
    const dots = unseenReplyKeys(questions, new Set());
    expect(dots.has("0002-beta")).toBe(false);
  });

  it("drops a lesson once its replied question has been seen", () => {
    const dots = unseenReplyKeys(questions, new Set(["q1"]));
    expect(dots.has("0001-alpha")).toBe(false);
    expect(dots.has("0003-gamma")).toBe(true);
  });
});

describe("cardIdFromHash", () => {
  it("returns the card id from a hash, stripping the leading #", () => {
    expect(cardIdFromHash("#dhanya")).toBe("dhanya");
    expect(cardIdFromHash("#perfective-aspect")).toBe("perfective-aspect");
  });

  it("returns null for an empty or bare-# hash (no fragment → no-op)", () => {
    expect(cardIdFromHash("")).toBeNull();
    expect(cardIdFromHash("#")).toBeNull();
    expect(cardIdFromHash("   ")).toBeNull();
  });

  it("decodes percent-encoding, falling back to the raw value on a malformed escape", () => {
    expect(cardIdFromHash("#is%20karan")).toBe("is karan");
    expect(cardIdFromHash("#bad%")).toBe("bad%");
  });
});

describe("composeCardShare (reference-cards/03)", () => {
  const base = { courseTitle: "Hindi", brand: "Y-Knot", url: "https://app.example.com/share/tok1" };

  it("builds the branded snippet: term, definition, CTA line, link", () => {
    expect(
      composeCardShare({ ...base, term: "Perfective aspect", definition: "An action viewed as a complete whole." }),
    ).toBe(
      "📖 Perfective aspect\nAn action viewed as a complete whole.\n\nLearn Hindi on Y-Knot →\nhttps://app.example.com/share/tok1",
    );
  });

  it("collapses the authored whitespace/newlines the iframe hands back as textContent", () => {
    expect(
      composeCardShare({ ...base, term: "  dhanya \n (dhanya)", definition: "blessed,\n  fortunate,   happy" }),
    ).toBe("📖 dhanya (dhanya)\nblessed, fortunate, happy\n\nLearn Hindi on Y-Knot →\nhttps://app.example.com/share/tok1");
  });

  it("omits the definition line when a card has no definition text", () => {
    expect(composeCardShare({ ...base, term: "जो", definition: "" })).toBe(
      "📖 जो\n\nLearn Hindi on Y-Knot →\nhttps://app.example.com/share/tok1",
    );
  });
});

describe("resolveArtifactClick — card deep-link hash preservation (reference-cards/02)", () => {
  it("preserves the #card fragment on a reference cross-link for an authed reader", () => {
    // The Frame handler appends url.hash after resolving; the resolver navigates the
    // reference path unchanged, so the fragment survives to the router.
    const action = resolveArtifactClick("/courses/hindi/references/glossary", "/courses/hindi/lessons/0003");
    expect(action).toEqual({ kind: "navigate", path: "/courses/hindi/references/glossary" });
  });

  it("rewrites a reference card link into the Guest share context, ready for the #card fragment", () => {
    expect(internalNavTarget("/courses/hindi/references/glossary", "/share/tok1/lessons/0003")).toBe(
      "/share/tok1/references/glossary",
    );
  });
});

describe("seenAfterOpening", () => {
  const questions = [
    { id: "q1", lessonKey: "0001-alpha", reply: "answer" },
    { id: "q2", lessonKey: "0001-alpha", reply: null }, // open, no reply
    { id: "q3", lessonKey: "0002-beta", reply: "answer" },
  ];

  it("marks the opened lesson's replied questions as seen", () => {
    const next = seenAfterOpening(questions, "0001-alpha", new Set());
    expect(next.has("q1")).toBe(true);
  });

  it("does not mark questions from other lessons, or unanswered ones", () => {
    const next = seenAfterOpening(questions, "0001-alpha", new Set());
    expect(next.has("q2")).toBe(false); // same lesson, no reply
    expect(next.has("q3")).toBe(false); // other lesson
  });

  it("returns the same set reference when there is nothing new to mark", () => {
    const seen = new Set(["q1"]);
    expect(seenAfterOpening(questions, "0001-alpha", seen)).toBe(seen);
  });

  it("returns the same set reference when the lesson has no replied questions", () => {
    const seen = new Set<string>();
    expect(seenAfterOpening(questions, "0002-beta", new Set(["q3"]))).not.toBe(seen);
    // a lesson with no replies at all leaves seen untouched
    expect(seenAfterOpening(questions, "no-such-lesson", seen)).toBe(seen);
  });
});
