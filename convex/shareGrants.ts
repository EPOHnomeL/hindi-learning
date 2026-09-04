import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { SOURCE_LANG } from "./sourceLang";

// Share and email primitives: how a Share row's absent fields read, how an email
// is keyed, and how a pending invite becomes a real Share. (Plain module, no
// Convex functions registered here.) Split out of `edition.ts` (then `lib.ts`) by
// technical-foundation/16: the invite rail is not the Edition access stack that
// file exists for.

// A Share's granted Edition language. Legacy Shares (pre course-translation)
// carry no `lang` and grant the English edition.
export function shareLang(s: Doc<"shares">): string {
  return s.lang ?? SOURCE_LANG;
}

// A Share/pendingShare's access level (ADR 0020). Absent reads as "viewer", so
// every pre-Editor row stays read-only — mirrors `shareLang`.
export function shareRole(s: { role?: "viewer" | "editor" }): "viewer" | "editor" {
  return s.role ?? "viewer";
}

// Trim + lower-case — the one email normalisation used everywhere a person is
// named by address (shares, invites), matching how Convex Auth stores
// `users.email` and how the Allowlist stores its rows. Without it a lookup would
// miss on casing/whitespace alone.
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Turn any pending Shares (invites) for a freshly-created account into real
// Shares. Called from the sign-up callback right after the `users` row is
// inserted, so an email invited before it had an account gains read access the
// moment it signs up. Idempotent per (Topic, Viewer): skips a Topic already
// shared, and clears the invite either way.
export async function claimPendingShares(ctx: MutationCtx, userId: Id<"users">, email: string): Promise<void> {
  const pending = await ctx.db
    .query("pendingShares")
    .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
    .collect();
  for (const invite of pending) {
    const lang = invite.lang ?? SOURCE_LANG;
    // Dedup per (Topic, Viewer, Edition): a Viewer may hold several Shares on one
    // Topic (one per language), so match on lang, not just the pair. In-memory —
    // legacy rows carry no `lang`, which an index `.eq` can't match cleanly.
    const existing = await ctx.db
      .query("shares")
      .withIndex("by_topic_viewer", (q) => q.eq("topicId", invite.topicId).eq("viewerId", userId))
      .collect();
    if (!existing.some((s) => shareLang(s) === lang)) {
      // Carry the invite's role (ADR 0020) onto the real Share, so an email
      // pre-set as Editor becomes an Editor the moment it signs up.
      await ctx.db.insert("shares", { topicId: invite.topicId, viewerId: userId, lang, role: shareRole(invite) });
    }
    await ctx.db.delete(invite._id);
  }
}
