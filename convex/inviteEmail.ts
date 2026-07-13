// The invite-email renderer (see .scratch/invite-emails). A pure, dependency-free
// module — no Convex server imports — so it's unit-testable without a runtime and
// reused by the `email.sendInvite` action to build the Resend payload.

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

// The product name shown to recipients. Matches the my-course.app domain they
// see in the From address and the link.
const BRAND = "My Course";

// Warm palette, aligned with the app (maroon accent, cream/brown).
const C = {
  page: "#f5efe6",
  card: "#ffffff",
  border: "#e7ddd4",
  heading: "#2b2320",
  body: "#4a413b",
  muted: "#8a7d70",
  faint: "#a89b8d",
  accent: "#8a3324",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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
  let heading: string;
  let lead: string;
  let cta: string;
  if (kind === "invited") {
    subject = `You’ve been invited to “${courseTitle}”`;
    heading = "You’ve been invited";
    lead = `${inviterEmail} invited you to ${edition} on ${BRAND}. Create your account to get ${access(role)} access.`;
    cta = "Create your account";
  } else if (kind === "role-changed") {
    subject = `Your access to “${courseTitle}” changed`;
    heading = "Your access changed";
    lead = `${inviterEmail} changed your access to ${edition} on ${BRAND}. You are now ${roleNoun(role)} — you have ${access(role)} access.`;
    cta = "Open the course";
  } else {
    subject = `You’ve been given access to “${courseTitle}”`;
    heading = "You’ve been given access";
    lead = `${inviterEmail} gave you ${access(role)} access to ${edition} on ${BRAND}.`;
    cta = "Open the course";
  }

  const text = `${heading}\n\n${lead}\n\n${cta}: ${link}\n\nYou received this because someone shared a course with you on ${BRAND}.\n`;

  const html = `<!-- invite email -->
<div style="margin:0;padding:0;background:${C.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(lead)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:0 4px 20px;font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:0.3px;color:${C.accent};">${BRAND}</td>
          </tr>
          <tr>
            <td style="background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:32px;font-family:${FONT};">
              <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;font-weight:700;color:${C.heading};">${esc(heading)}</h1>
              <p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:${C.body};">${esc(lead)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="border-radius:8px;background:${C.accent};">
                    <a href="${esc(link)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${cta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:26px 0 0;font-size:13px;line-height:1.5;color:${C.muted};">Or paste this link into your browser:<br><a href="${esc(link)}" style="color:${C.accent};word-break:break-all;">${esc(link)}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.faint};">You received this because someone shared a course with you on ${BRAND}.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;

  return { subject, html, text };
}
