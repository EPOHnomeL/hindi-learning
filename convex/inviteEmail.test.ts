import { describe, expect, test } from "vitest";
import { renderInviteEmail } from "./inviteEmail";

const base = {
  courseTitle: "Hindi 101",
  langName: "Afrikaans",
  inviterEmail: "owner@example.com",
  role: "viewer" as const,
  link: "https://app.example.com/courses/hindi?lang=af",
};

test("granted: names the course, language, inviter, view access, and deep link", () => {
  const { subject, html, text } = renderInviteEmail("granted", base);
  expect(subject).toContain("Hindi 101");
  for (const body of [html, text]) {
    expect(body).toContain("Hindi 101");
    expect(body).toContain("Afrikaans");
    expect(body).toContain("owner@example.com");
    expect(body).toContain("view");
    expect(body).toContain(base.link);
  }
});

test("invited: prompts account creation and links to the given (sign-up) URL", () => {
  const link = "https://app.example.com/";
  const { subject, text } = renderInviteEmail("invited", { ...base, link });
  expect(subject.toLowerCase()).toContain("invited");
  expect(text.toLowerCase()).toContain("account");
  expect(text).toContain(link);
});

test("role-changed to editor: states the new Editor role", () => {
  const { subject, text } = renderInviteEmail("role-changed", { ...base, role: "editor" });
  expect(subject).toContain("Hindi 101");
  expect(text).toContain("Editor");
});

test("editor role in a grant reads as edit access", () => {
  const { text } = renderInviteEmail("granted", { ...base, role: "editor" });
  expect(text).toContain("edit");
});

test("html-escapes the course title so a stray angle bracket can't break markup", () => {
  const { html } = renderInviteEmail("granted", { ...base, courseTitle: "A <b> course" });
  expect(html).toContain("A &lt;b&gt; course");
  expect(html).not.toContain("A <b> course");
});

// The audio announcement (2026-11-27): two wordings, one per audience.
describe("the audio announcement", () => {
  const data = {
    courseTitle: "Prophetic School",
    langName: "English",
    inviterEmail: "owner@example.com",
    role: "viewer" as const,
    link: "https://app.example.com/courses/prophetic-school",
  };

  test("a holder is told they can listen, how, and is not told they were invited", () => {
    const { subject, text, html } = renderInviteEmail("audio", data);
    expect(subject).toContain("listen");
    expect(text).toContain("press play");
    expect(text).toContain("male or female");
    expect(text).not.toContain("owner@example.com");
    expect(text).toContain("because you have access to a course");
    expect(html).toContain(`href="${data.link}"`);
  });

  test("an invitee with no account is told the site invited them and to create an account", () => {
    const { text } = renderInviteEmail("audio-invited", data);
    // The site is the inviter, not the owner's own address.
    expect(text).toContain("My Course invited you to “Prophetic School”");
    expect(text).not.toContain("owner@example.com");
    expect(text).toContain("Create your account");
    expect(text).toContain("because someone shared a course with you");
  });

  test("both say other languages are coming and where to write, with a mail link", () => {
    for (const kind of ["audio", "audio-invited"] as const) {
      const { text, html } = renderInviteEmail(kind, data);
      expect(text).toContain("English for now");
      expect(text).toContain("other languages");
      expect(text).toContain("support@my-course.app");
      expect(html).toContain('href="mailto:support@my-course.app"');
    }
  });

  test("no other email gains the second paragraph", () => {
    for (const kind of ["granted", "invited", "role-changed", "purchased", "reminder", "translator"] as const) {
      expect(renderInviteEmail(kind, data).text).not.toContain("support@my-course.app");
    }
  });

  test("neither wording names a voice by its internal name", () => {
    for (const kind of ["audio", "audio-invited"] as const) {
      expect(renderInviteEmail(kind, data).text).not.toMatch(/michael|emma|kokoro/i);
    }
  });
});
