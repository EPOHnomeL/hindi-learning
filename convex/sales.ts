import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isCallerAdmin } from "./whitelist";
import { translatedTitle } from "./lib";

// The admin sales report (.scratch/admin-sales, issue 01): which courses and
// which editions sold how much over a chosen period. Reads the whole sales
// ledger (both `owed` and already-`paid` rows — this is history, not what's
// still owed), keeps only rows whose sale timestamp falls in the window, and
// rolls the survivors up by course then by edition. Amounts are `gross` in
// cents, ZAR. Admin-only.
//
// ponytail: `ledger` has no time-range index (only `by_status`), so this does a
// bounded full `.collect()` and filters in JS. Fine at current scale; if the
// ledger ever grows large, add a time index and range-scan instead.
export const report = query({
  args: {
    // Inclusive lower / exclusive upper bound on the sale time (ms). Either may
    // be omitted — both omitted means "all time".
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      topicId: v.id("topics"),
      courseTitle: v.string(),
      gross: v.number(),
      count: v.number(),
      editions: v.array(
        v.object({
          lang: v.string(),
          title: v.string(),
          gross: v.number(),
          count: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { from, to }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");

    const rows = await ctx.db.query("ledger").collect();
    const inWindow = rows.filter(
      (r) => (from === undefined || r._creationTime >= from) && (to === undefined || r._creationTime < to),
    );

    // topicId -> lang -> running { gross, count }.
    const byCourse = new Map<Id<"topics">, Map<string, { gross: number; count: number }>>();
    for (const r of inWindow) {
      const editions = byCourse.get(r.topicId) ?? new Map();
      const agg = editions.get(r.lang) ?? { gross: 0, count: 0 };
      agg.gross += r.gross;
      agg.count += 1;
      editions.set(r.lang, agg);
      byCourse.set(r.topicId, editions);
    }

    const courses = await Promise.all(
      [...byCourse.entries()].map(async ([topicId, editionMap]) => {
        const topic = await ctx.db.get(topicId);
        const courseTitle = topic?.title ?? "(deleted course)";
        const editions = await Promise.all(
          [...editionMap.entries()].map(async ([lang, agg]) => ({
            lang,
            title: topic ? await translatedTitle(ctx, topicId, lang, topic.title) : lang,
            gross: agg.gross,
            count: agg.count,
          })),
        );
        editions.sort((a, b) => b.gross - a.gross);
        return {
          topicId,
          courseTitle,
          gross: editions.reduce((sum, e) => sum + e.gross, 0),
          count: editions.reduce((sum, e) => sum + e.count, 0),
          editions,
        };
      }),
    );
    courses.sort((a, b) => b.gross - a.gross);
    return courses;
  },
});
