import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { paletteFromTokens, renderInviteEmail } from "./inviteEmail";
import type { Brand } from "./inviteEmail";

// Best-effort transactional email for invites (see .scratch/invite-emails).
// Scheduled from `shareTopic` / `setShareRole` after the mutation commits, so a
// slow or failing send never blocks or breaks the invite. Sends via Resend's
// REST API with `fetch` — the default Convex runtime (no `"use node"`), no deps.
// `INVITE_FROM_EMAIL` must be an address on a domain verified in Resend.
// Upgrade path: swap this one fetch for the durable @convex-dev/resend component
// (queued retries + idempotency) — the renderer, triggers, and tests are unchanged.

const RESEND_URL = "https://api.resend.com/emails";

export const sendInvite = internalAction({
  args: {
    to: v.string(),
    kind: v.union(v.literal("granted"), v.literal("invited"), v.literal("role-changed")),
    courseTitle: v.string(),
    langName: v.string(),
    inviterEmail: v.string(),
    role: v.union(v.literal("viewer"), v.literal("editor")),
    link: v.string(),
    // The inviter's tenant brand, resolved by the calling mutation from the shared
    // course's tenant (whitelabel issue 14 / ADR 0021): the tenant `displayName`,
    // its raw **light** theme tokens (the action derives the email palette from
    // them), and the logo's absolute URL (null → wordmark). Absent → the default
    // site: house branding, byte-identical to the pre-whitelabel email.
    brand: v.optional(
      v.object({
        name: v.string(),
        light: v.record(v.string(), v.string()),
        logoUrl: v.union(v.string(), v.null()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (_ctx, { to, kind, courseTitle, langName, inviterEmail, role, link, brand: brandArg }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.INVITE_FROM_EMAIL;
    if (!apiKey || !from) {
      // Ship before Resend is configured: log and no-op rather than throw.
      console.warn("sendInvite: RESEND_API_KEY / INVITE_FROM_EMAIL unset — skipping email");
      return null;
    }

    const brand: Brand | undefined = brandArg
      ? { name: brandArg.name, colors: paletteFromTokens(brandArg.light), logoUrl: brandArg.logoUrl }
      : undefined;

    const { subject, html, text } = renderInviteEmail(kind, { courseTitle, langName, inviterEmail, role, link }, brand);
    try {
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        // Resend takes `from` as a plain "Name <email>" string and `to` as a list.
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });
      if (!res.ok) {
        console.error(`sendInvite: Resend ${res.status} sending "${kind}" to ${to}: ${await res.text()}`);
      }
    } catch (err) {
      // Best-effort: a send failure must not surface as an invite error.
      console.error(`sendInvite: failed sending "${kind}" to ${to}:`, err);
    }
    return null;
  },
});
