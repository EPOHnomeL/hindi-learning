// The password-reset rail (technical-foundation ticket 21): the Auth.js-style
// email provider that `Password({ reset })` hands a reset request to. Convex Auth
// mints the code, stores only its hash, and calls `sendVerificationRequest` with
// the plaintext once; this file's whole job is to decide what the code looks like
// and to put it in an email.
//
// It rides the SAME Resend rail as `email.ts`: one raw `fetch`, the same
// `RESEND_API_KEY` / `INVITE_FROM_EMAIL` env vars, no new dependency and no
// `"use node"` (`fetch` is in the default Convex runtime). When that rail is
// swapped for the durable `@convex-dev/resend` component, both callers change
// together and nothing else here moves.

import { Email } from "@convex-dev/auth/providers/Email";
import type { EmailConfig } from "@convex-dev/auth/server";
import { RESET_CODE_TTL_MINUTES, renderResetEmail } from "./resetEmail";

const RESEND_URL = "https://api.resend.com/emails";

const CODE_LENGTH = 8;

// Eight digits, drawn from the platform CSPRNG. Digits rather than a mixed
// alphabet because this is retyped by hand, often off a phone held in the other
// hand: the library's default token is 32 alphanumerics, which nobody transcribes
// correctly. Eight digits is 10^8, and the code dies in 15 minutes.
//
// Bytes of 250 and up are thrown away rather than folded in. 256 is not a multiple
// of 10, so a plain `% 10` would make 0 to 5 measurably likelier than 6 to 9 and
// quietly shrink the search space; 250 is, so the rejection makes it uniform.
async function generateVerificationToken(): Promise<string> {
  const digits: string[] = [];
  while (digits.length < CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(CODE_LENGTH))) {
      if (byte < 250 && digits.length < CODE_LENGTH) digits.push(String(byte % 10));
    }
  }
  return digits.join("");
}

// `Email()` gives us the identifier check for free: the OTP is only accepted
// alongside the same email address the reset was requested for, so a code
// harvested from one inbox cannot be spent against another account. Its `id` and
// `maxAge` are fixed constants though, so they are overridden here rather than
// passed in.
export const ResendOTPPasswordReset: EmailConfig = {
  ...Email({
    sendVerificationRequest: async ({ identifier: to, token }) => {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.INVITE_FROM_EMAIL;
      if (!apiKey || !from) {
        // Same convention as `sendInvite`: a deployment without Resend
        // provisioned logs and no-ops rather than throwing, so local dev is not
        // blocked by an env var it does not have. The reset simply cannot be
        // completed there, which is the honest outcome.
        console.warn("passwordReset: RESEND_API_KEY / INVITE_FROM_EMAIL unset, skipping email");
        return;
      }

      const { subject, html, text } = renderResetEmail(token);
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });
      // Unlike `sendInvite`, a failure here is NOT swallowed. An invite is a
      // courtesy on top of a grant that already committed; this email IS the
      // reset, and a silent success that never arrives would leave the user
      // waiting on a code that does not exist. Convex Auth surfaces the throw to
      // the caller, and the code stays unused until it expires.
      if (!res.ok) {
        throw new Error(`passwordReset: Resend ${res.status}: ${await res.text()}`);
      }
    },
  }),
  id: "password-reset-otp",
  maxAge: RESET_CODE_TTL_MINUTES * 60,
  generateVerificationToken,
};
