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

// The flat, inline-hex palette the email markup interpolates. Kept separate from
// the 14-token tenant palette: email is light-only (dark mode is client-controlled,
// not worth chasing) and needs just these eight slots.
export type Palette = {
  page: string;
  card: string;
  border: string;
  heading: string;
  body: string;
  muted: string;
  faint: string;
  accent: string;
};

// Tenant branding for an invite (whitelabel issue 14). When present, the email
// carries the inviter's tenant brand instead of the default site's: `name` is the
// tenant `displayName`, `colors` its derived palette, `logoUrl` an absolute
// storage URL for the header logo (null → text wordmark fallback).
export type Brand = {
  name: string;
  colors: Palette;
  logoUrl: string | null;
};

// The product name shown to recipients. Matches the my-course.app domain they
// see in the From address and the link.
const BRAND = "My Course";

// Warm palette, aligned with the app (maroon accent, cream/brown).
const C: Palette = {
  page: "#f5efe6",
  card: "#ffffff",
  border: "#e7ddd4",
  heading: "#2b2320",
  body: "#4a413b",
  muted: "#8a7d70",
  faint: "#a89b8d",
  accent: "#8a3324",
};

// The default-site brand: the house name, palette, and no logo (text wordmark).
// Passing this — or nothing — renders exactly as the pre-whitelabel email did.
const DEFAULT_BRAND: Brand = { name: BRAND, colors: C, logoUrl: null };

// Derive the email palette from a tenant's **light** theme tokens (whitelabel
// issue 14 / ticket 03 decision 7). Light-only by design. The ticket's mapping:
// page←paper, card←card, border←line, heading←ink, body/muted←soft, accent←accent;
// `faint` (the faintest footer text) has no dedicated token, so it also takes
// `soft`. A missing token falls back to the default so a partial palette can't
// blank out a slot.
export function paletteFromTokens(light: Record<string, string>): Palette {
  const t = (token: string, fallback: string) => light[token] ?? fallback;
  return {
    page: t("paper", C.page),
    card: t("card", C.card),
    border: t("line", C.border),
    heading: t("ink", C.heading),
    body: t("soft", C.body),
    muted: t("soft", C.muted),
    faint: t("soft", C.faint),
    accent: t("accent", C.accent),
  };
}
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
export function renderInviteEmail(kind: InviteKind, data: InviteData, brand: Brand = DEFAULT_BRAND): RenderedEmail {
  const { courseTitle, langName, inviterEmail, role, link } = data;
  const { name: BRAND, colors: C, logoUrl } = brand;
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

  // Header: the tenant logo (absolute storage URL) when set, else the text
  // wordmark (the brand name in the accent colour) — the pre-whitelabel default.
  const wordmark = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(BRAND)}" height="32" style="display:block;height:32px;width:auto;border:0;outline:none;text-decoration:none;">`
    : BRAND;

  const html = `<!-- invite email -->
<div style="margin:0;padding:0;background:${C.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(lead)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:0 4px 20px;font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:0.3px;color:${C.accent};">${wordmark}</td>
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
