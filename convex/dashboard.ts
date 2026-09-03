import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOwnedTopic } from "./topicAccess";
import { normaliseEmail, shareLang, shareRole } from "./shareGrants";
import { SOURCE_LANG } from "./sourceLang";

// The manage route's Dashboard tab (ui-overhaul 23): ONE owner-gated course-wide
// query behind the whole tab. Course-wide on purpose, because the obvious way to
// draw it was `shares.listEditionAccess`, which is per Edition, so a fourteen
// language course would fire fourteen queries to render one panel.
//
// It answers only what the client cannot already derive. `translate.editions` is
// loaded by ManageShell and already carries the edition list and each Edition's
// published flag, so the "editions" and "published" stats are counted there, not
// here. What needs the server is the access rows, the prices, and the progress
// aggregate.

// ---- The progress histogram's bucket edges (ui-overhaul 23) ----------------

// SEVEN buckets, not the ten-of-10% the operator sketched. 0% and 100% are the
// two rungs an owner actually acts on (nudge the untouched, congratulate and
// certificate the finished), so each is its own exact bucket and is never
// diluted by a neighbour that is merely near it. The five interior bands are
// half-open [lo, hi) and 20 points wide, which keeps the panel at seven rows:
// twelve rows (ten bands plus two exact) does not read at 360px, and the manage
// route is phone first.
//
// The keys are stable strings, and the ORDER of this array is the render order.
// The client maps a key to its label; nothing infers the edges from the name.
export const PROGRESS_BUCKETS = ["0", "1-20", "20-40", "40-60", "60-80", "80-99", "100"] as const;
export type ProgressBucket = (typeof PROGRESS_BUCKETS)[number];

// Which bucket a reader falls in, from their completed/total. `total === 0` (a
// course with no Lessons yet) is 0%, not a division by zero. Exact 100 only for
// genuinely every Lesson: 99.6% rounds to 100 as a percentage and would be a lie
// in the bucket an owner mints Certificates from, so the comparison is on the
// counts, never on the rounded percentage.
export function progressBucket(completed: number, total: number): ProgressBucket {
  if (total <= 0 || completed <= 0) return "0";
  if (completed >= total) return "100";
  const pct = (completed / total) * 100;
  if (pct < 20) return "1-20";
  if (pct < 40) return "20-40";
  if (pct < 60) return "40-60";
  if (pct < 80) return "60-80";
  return "80-99";
}

// The `progress` scan's ceiling. The aggregate is one indexed range read over
// `by_topic_user_lesson` at `topicId`, every reader's every row for this course,
// grouped by reader in memory, which is readers x lessons documents on every
// dashboard open. That is the read amplification the ticket flags, and this is
// the answer to it: past the cap the query REFUSES TO GUESS, returning
// `truncated: true` and no buckets, rather than a histogram computed from a
// partial scan that would silently under-count every reader the scan cut off.
// A denormalised per-reader counter is the fix if a real course ever trips this;
// at 8192 rows none is close (ticket 14 counted 68 Shares across 14 courses).
const PROGRESS_SCAN_CAP = 8192;

export const courseStats = query({
  args: { topicSlug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      // Distinct people with access to any Edition, accounts and pending
      // invites alike, the owner excluded.
      people: v.number(),
      // Of those, how many hold Editor on at least one Edition.
      editors: v.number(),
      // One row per Edition that has anyone on it, `people` counted the way the
      // Users tab's roster counts: accepted grants plus pending invites.
      perLanguage: v.array(v.object({ lang: v.string(), people: v.number() })),
      // Every priced Edition. A lang absent from this list is free.
      prices: v.array(v.object({ lang: v.string(), amount: v.number(), currency: v.string() })),
      lessonCount: v.number(),
      // The histogram's population: ACCOUNTS only (a pending invite has no
      // account and so cannot have read anything), the owner excluded.
      learners: v.number(),
      buckets: v.array(v.object({ key: v.string(), count: v.number() })),
      truncated: v.boolean(),
      // One row per (editor, Edition) for the foot of the tab (ui-overhaul 26).
      // `completed` is that PERSON's own completion marks over the whole course
      // and is repeated on each of their rows, because a mark carries no
      // language (see the note above `editorRows` below). Owner-gated PII: this
      // is the only part of the query that carries an email.
      editorRows: v.array(
        v.object({
          lang: v.string(),
          person: v.string(),
          pending: v.boolean(),
          completed: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return null;
    const ownerId = topic.ownerId;

    // One indexed read per grant kind, course-wide. Legacy Shares carry no
    // `lang`; `shareLang` reads them as English, matching `listEditionAccess`.
    const shares = await ctx.db.query("shares").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
    const pending = await ctx.db
      .query("pendingShares")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    const listings = await ctx.db.query("listings").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();

    // A person is keyed by account id, or by email while they have no account,
    // so the same human is not double counted across grant kinds. They are
    // counted once per Edition they hold: someone with English and Spanish is a
    // row on both languages and one person in `people`.
    const byLang = new Map<string, Set<string>>();
    const everyone = new Set<string>();
    const editors = new Set<string>();
    const accounts = new Set<Id<"users">>();
    // The (editor, Edition) pairs, kept in grant order and resolved to people
    // after the walk so the name lookup happens once per editor account.
    const editorGrants: { lang: string; userId: Id<"users"> | null; email: string | null }[] = [];
    const grant = (lang: string, key: string) => {
      const set = byLang.get(lang) ?? new Set<string>();
      set.add(key);
      byLang.set(lang, set);
      everyone.add(key);
    };

    for (const s of shares) {
      if (s.viewerId === ownerId) continue;
      grant(shareLang(s), s.viewerId);
      accounts.add(s.viewerId);
      if (shareRole(s) === "editor") {
        editors.add(s.viewerId);
        editorGrants.push({ lang: shareLang(s), userId: s.viewerId, email: null });
      }
    }
    for (const p of pending) {
      const key = `email:${normaliseEmail(p.email)}`;
      grant(p.lang ?? SOURCE_LANG, key);
      if (shareRole(p) === "editor") {
        editors.add(key);
        editorGrants.push({ lang: p.lang ?? SOURCE_LANG, userId: null, email: normaliseEmail(p.email) });
      }
    }
    // The paid and self-serve twins of a Share: access, never an editing right,
    // so neither can put anyone in `editors`.
    for (const e of entitlements) {
      if (e.userId === ownerId) continue;
      grant(e.lang, e.userId);
      accounts.add(e.userId);
    }
    for (const e of enrollments) {
      if (e.userId === ownerId) continue;
      grant(e.lang, e.userId);
      accounts.add(e.userId);
    }

    const lessons = (
      await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
    ).filter((l) => !l.supersededBy);
    const live = new Set(lessons.map((l) => l.key));

    // The aggregate. One range read at `topicId`; the `+ 1` is how we learn we
    // hit the cap without a second query.
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id))
      .take(PROGRESS_SCAN_CAP + 1);
    const truncated = rows.length > PROGRESS_SCAN_CAP;

    const done = new Map<Id<"users">, number>();
    if (!truncated) {
      for (const r of rows) {
        if (r.userId === ownerId) continue;
        // Someone reading a free published Edition holds no grant row at all,
        // so their progress is the only evidence they exist. Count them.
        accounts.add(r.userId);
        if (r.status !== "completed" || !live.has(r.lessonKey)) continue;
        done.set(r.userId, (done.get(r.userId) ?? 0) + 1);
      }
    }

    const counts = new Map<string, number>(PROGRESS_BUCKETS.map((k) => [k, 0]));
    if (!truncated) {
      for (const id of accounts) {
        const key = progressBucket(done.get(id) ?? 0, lessons.length);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    // One name lookup per distinct editor account, not per grant, so a person
    // editing six Editions is still read once.
    const person = new Map<Id<"users">, string>();
    for (const id of new Set(editorGrants.map((g) => g.userId).filter((x): x is Id<"users"> => x !== null))) {
      const user = await ctx.db.get(id);
      person.set(id, user?.name?.trim() || user?.email || "");
    }

    return {
      people: everyone.size,
      editors: editors.size,
      perLanguage: [...byLang.entries()]
        .map(([lang, set]) => ({ lang, people: set.size }))
        .sort((a, b) => b.people - a.people || a.lang.localeCompare(b.lang)),
      prices: listings
        .map((l) => ({ lang: l.lang, amount: l.amount, currency: l.currency }))
        .sort((a, b) => a.lang.localeCompare(b.lang)),
      lessonCount: lessons.length,
      learners: truncated ? 0 : accounts.size,
      buckets: PROGRESS_BUCKETS.map((key) => ({ key, count: counts.get(key) ?? 0 })),
      truncated,
      editorRows: editorGrants
        .map((g) => ({
          lang: g.lang,
          person: g.userId ? (person.get(g.userId) ?? "") : (g.email ?? ""),
          pending: g.userId === null,
          // An editor's progress is the SAME completion mark a learner leaves
          // (`progress.status === "completed"`), which is what the operator
          // ruled on 2026-09-01. A mark carries no language, so this figure is
          // the person's across the whole course and repeats on each of their
          // rows; the tab says so rather than letting it read as per Edition.
          completed: g.userId ? (done.get(g.userId) ?? 0) : 0,
        }))
        .sort((a, b) => a.lang.localeCompare(b.lang) || a.person.localeCompare(b.person)),
    };
  },
});
