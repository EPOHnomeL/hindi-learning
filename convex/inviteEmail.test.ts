import { expect, test } from "vitest";
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
