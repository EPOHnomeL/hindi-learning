import { describe, expect, it } from "vitest";
import { guestArgs, guestHref, guestRoute, guestScope } from "./guestSource";

describe("guestArgs", () => {
  it("sends only the token on the share entrance", () => {
    expect(guestArgs({ token: "abc" })).toEqual({ token: "abc" });
  });
  it("sends the slug, and the language only when there is one", () => {
    expect(guestArgs({ slug: "prophetic-school", lang: null })).toEqual({ slug: "prophetic-school" });
    expect(guestArgs({ slug: "prophetic-school", lang: "hi" })).toEqual({ slug: "prophetic-school", lang: "hi" });
  });
});

describe("guestHref", () => {
  it("builds share links under the token", () => {
    expect(guestHref({ token: "abc" }, "/lessons/0001")).toBe("/share/abc/lessons/0001");
  });
  it("builds course links under the slug, carrying the Edition language", () => {
    expect(guestHref({ slug: "ps", lang: null }, "/lessons/0001")).toBe("/courses/ps/lessons/0001");
    expect(guestHref({ slug: "ps", lang: "hi" }, "/lessons/0001")).toBe("/courses/ps/lessons/0001?lang=hi");
  });
});

describe("guestScope", () => {
  it("scopes per Edition per entrance", () => {
    expect(guestScope({ token: "abc" })).toBe("abc");
    expect(guestScope({ slug: "ps", lang: "hi" })).toBe("ps:hi");
    expect(guestScope({ slug: "ps", lang: null })).toBe("ps:");
  });
});

describe("guestRoute", () => {
  it("reads the three reader surfaces", () => {
    expect(guestRoute("/courses/ps")).toEqual({ slug: "ps", kind: "index" });
    expect(guestRoute("/courses/ps/lessons/0001-a")).toEqual({ slug: "ps", kind: "lesson", key: "0001-a" });
    expect(guestRoute("/courses/ps/references/names")).toEqual({ slug: "ps", kind: "reference", key: "names" });
  });
  it("decodes percent-encoded keys", () => {
    expect(guestRoute("/courses/ps/references/a%20b")).toEqual({ slug: "ps", kind: "reference", key: "a b" });
  });
  it("refuses the owner console and anything that is not a course path", () => {
    expect(guestRoute("/courses/ps/manage")).toBeNull();
    expect(guestRoute("/courses")).toBeNull();
    expect(guestRoute("/settings")).toBeNull();
    expect(guestRoute("/courses/ps/lessons")).toBeNull();
    expect(guestRoute("/courses/ps/quizzes/1")).toBeNull();
  });
});
