// The password-reset OTP email (technical-foundation ticket 21). Pure and
// dependency-free, exactly like its sibling `inviteEmail.ts`, so the whole thing
// is unit-testable without a Convex runtime; `passwordReset.ts` calls it to build
// the Resend payload.
//
// It borrows the invite email's palette, font and house name rather than
// restating them, so the two emails cannot drift apart.
//
// **Deliberately house-branded, not tenant-branded.** The invite email carries the
// inviter's tenant brand because the mutation that schedules it already knows the
// tenant. A reset is requested from the sign-in form by someone who is not signed
// in and belongs to no tenant yet: the auth provider is handed the email address
// and nothing else, so there is no tenant to resolve. Adding one would mean
// widening the reset params, which this ticket rules out.

import { BRAND, C, FONT, type RenderedEmail } from "./inviteEmail";

// How long a code is good for. `passwordReset.ts` turns this into the provider's
// `maxAge`, and the email says it in words: one constant, so the promise in the
// email and the expiry that enforces it can never disagree.
export const RESET_CODE_TTL_MINUTES = 15;

const HEADING = "Reset your password";
const LEAD = `Enter this code on the sign-in page to choose a new password. It expires in ${RESET_CODE_TTL_MINUTES} minutes.`;
// Someone who did NOT ask for this has to be told, in the email itself, that doing
// nothing is safe. A reset request needs only an address, so an unsolicited code
// is an ordinary event and not evidence of a break-in.
const BECAUSE = `You received this because someone asked to reset the password for this address on ${BRAND}. If that wasn't you, you can safely ignore this email. Nothing has changed.`;

// Render the reset email to { subject, html, text }. `code` is the numeric OTP,
// which is the entire payload: there is no link, no button and no tracked URL
// anywhere in the markup (see the test). That is the point. The reader types the
// code back into the tab they already have open, so nothing here asks them to
// trust a link, and Resend has no anchor to rewrite with a click-tracking domain.
export function renderResetEmail(code: string): RenderedEmail {
  const subject = `${code} is your ${BRAND} password reset code`;

  const text = `${HEADING}\n\n${LEAD}\n\n${code}\n\n${BECAUSE}\n`;

  const html = `<!-- password reset email -->
<div style="margin:0;padding:0;background:${C.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${LEAD}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:0 4px 20px;font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:0.3px;color:${C.accent};">${BRAND}</td>
          </tr>
          <tr>
            <td style="background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:32px;font-family:${FONT};">
              <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;font-weight:700;color:${C.heading};">${HEADING}</h1>
              <p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:${C.body};">${LEAD}</p>
              <div style="border-radius:10px;background:${C.page};border:1px solid ${C.border};padding:18px;text-align:center;font-family:${FONT};font-size:30px;font-weight:700;letter-spacing:6px;color:${C.heading};">${code}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.faint};">${BECAUSE}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;

  return { subject, html, text };
}
