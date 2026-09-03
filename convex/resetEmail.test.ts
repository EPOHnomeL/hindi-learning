import { expect, test } from "vitest";
import { RESET_CODE_TTL_MINUTES, renderResetEmail } from "./resetEmail";

const CODE = "40711263";

test("the code is the whole email: it appears in the subject, the html and the text", () => {
  const { subject, html, text } = renderResetEmail(CODE);
  expect(subject).toContain(CODE);
  expect(html).toContain(CODE);
  expect(text).toContain(CODE);
});

test("it says how long the code lasts, in the same minutes the provider expires it after", () => {
  const { html, text } = renderResetEmail(CODE);
  for (const body of [html, text]) {
    expect(body).toContain(String(RESET_CODE_TTL_MINUTES));
  }
  expect(RESET_CODE_TTL_MINUTES).toBe(15);
});

// A reset email has nothing to click. No link means no click-tracking wrapper for
// Resend to rewrite, and nothing for a phishing-trained reader to be asked to trust:
// the code is typed back into the page they already have open.
test("carries no links at all, so there is nothing to track and nothing to click", () => {
  const { html, text } = renderResetEmail(CODE);
  expect(html).not.toContain("href=");
  expect(html).not.toContain("http");
  expect(text).not.toContain("http");
});

test("says plainly what to do if you did not ask for it", () => {
  const { text } = renderResetEmail(CODE);
  expect(text.toLowerCase()).toContain("ignore");
});
