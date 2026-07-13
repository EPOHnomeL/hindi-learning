// The invite-email renderer (see .scratch/invite-emails). A pure, dependency-free
// module — no Convex server imports — so it's unit-testable without a runtime and
// reused by the `email.sendInvite` action to build the SendGrid payload.

export type InviteKind = "granted" | "invited" | "role-changed";

export type InviteData = {
  courseTitle: string;
  langName: string;
  inviterEmail: string;
  role: "viewer" | "editor";
  // The URL the button/link points at: the Edition deep link (granted /
  // role-changed) or the sign-up page (invited).
  link: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

// Minimal HTML entity escape — enough to keep a stray angle bracket or quote in
// user-supplied text (course title, inviter email) from breaking the markup.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// "view" / "edit" — the access verb; and "Viewer" / "Editor" — the role noun.
const access = (role: InviteData["role"]) => (role === "editor" ? "edit" : "view");
const roleNoun = (role: InviteData["role"]) => (role === "editor" ? "Editor" : "Viewer");

// Render one invite email to { subject, html, text }. The three kinds:
// - "granted"      — recipient already has an account; deep-link into the Edition.
// - "invited"      — no account yet; link to sign-up.
// - "role-changed" — an accepted Viewer↔Editor change; deep-link into the Edition.
export function renderInviteEmail(kind: InviteKind, data: InviteData): RenderedEmail {
  const { courseTitle, langName, inviterEmail, role, link } = data;
  const edition = `the ${langName} edition of “${courseTitle}”`;

  let subject: string;
  let lead: string;
  let cta: string;
  if (kind === "invited") {
    subject = `You’ve been invited to “${courseTitle}”`;
    lead = `${inviterEmail} invited you to ${edition} on Y-Knot. Create your account to get ${access(role)} access.`;
    cta = "Create your account";
  } else if (kind === "role-changed") {
    subject = `Your access to “${courseTitle}” changed`;
    lead = `${inviterEmail} changed your access to ${edition} on Y-Knot. You are now ${roleNoun(role)} — you have ${access(role)} access.`;
    cta = "Open the course";
  } else {
    subject = `You’ve been given access to “${courseTitle}”`;
    lead = `${inviterEmail} gave you ${access(role)} access to ${edition} on Y-Knot.`;
    cta = "Open the course";
  }

  const text = `${lead}\n\n${cta}: ${link}\n`;
  const html = `<!-- invite email -->
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:520px;margin:0 auto">
  <p>${esc(lead)}</p>
  <p style="margin:28px 0">
    <a href="${esc(link)}" style="display:inline-block;background:#8a3324;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${cta}</a>
  </p>
  <p style="color:#666;font-size:14px">Or paste this link into your browser:<br><a href="${esc(link)}" style="color:#8a3324">${esc(link)}</a></p>
</div>`;

  return { subject, html, text };
}
