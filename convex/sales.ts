import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isCallerAdmin } from "./whitelist";
import { translatedTitle } from "./lib";
import type { Doc } from "./_generated/dataModel";

// The Sales report is revenue PER COURSE PER EDITION, so only sale rows belong
// in it — a donation has no course, and folding it in corrupts the per-course
// numbers (ADR 0027). This is also the crash guard: both queries below index by
// `topicId` and resolve a course title, so a donation row reaching either would
// be a "(deleted course)" row at best.
//
// Written as "not a donation" rather than "is a sale" on purpose: rows written
// before `kind` existed carry none, and they ARE sales — testing `=== "sale"`
// would silently drop the entire pre-ADR-0027 history from the report. Once
// `backfill.backfillLedgerKind` has run everywhere and `kind` is narrowed to
// required, the two are equivalent. **A third money kind must flip this to an
// allow-list** — that is the one way this predicate goes wrong.
type SaleRow = Doc<"ledger"> & { topicId: NonNullable<Doc<"ledger">["topicId"]>; lang: string };
function salesOnly(rows: Doc<"ledger">[]): SaleRow[] {
  return rows.filter((r): r is SaleRow => r.kind !== "donation" && r.topicId !== undefined && r.lang !== undefined);
}

// The admin sales report (.scratch/admin-sales, issue 01): which courses and
// which editions sold how much over a chosen period. Reads the sales ledger
// (both `owed` and already-`paid` rows — this is history, not what's still
// owed) over the requested time window and rolls the rows up by course then by
// edition. Amounts are `gross` in cents, ZAR. Admin-only.
//
// The window is a range on the sale timestamp (`ledger._creationTime`), served
// by Convex's built-in `by_creation_time` index — so a bounded period reads
// only the rows in it, not the whole table. An unbounded ("all time") report
// still walks every row, which is inherent to that request.
//
// **Donations are excluded** (ADR 0027, `salesOnly` below) and both queries in
// this file depend on it structurally, not cosmetically: they group by `topicId`
// and fetch a course title, and a donation row has neither.
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

    // Range-scan the built-in creation-time index for the window: `from`
    // inclusive, `to` exclusive, either open. An unbounded call reads the whole
    // ledger (unavoidable for an all-time report).
    const inWindow = await ctx.db
      .query("ledger")
      .withIndex("by_creation_time", (q) => {
        if (from !== undefined && to !== undefined) return q.gte("_creationTime", from).lt("_creationTime", to);
        if (from !== undefined) return q.gte("_creationTime", from);
        if (to !== undefined) return q.lt("_creationTime", to);
        return q;
      })
      .collect();

    // topicId -> lang -> running { gross, count }.
    const byCourse = new Map<Id<"topics">, Map<string, { gross: number; count: number }>>();
    for (const r of salesOnly(inWindow)) {
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

const DAY = 86_400_000;
const DAY_CAP = 366; // defensive: never return more than a year of buckets

// The same window as `report`, bucketed by UTC day and split by edition
// language — the shape the admin Sales-by-day chart plots. A separate query
// rather than another field on `report` so each chart subscribes to only what it
// draws; both range-scan the same creation-time index, and at ledger scale the
// second scan is cheaper than the coupling.
//
// Every day in the window is returned, sales or not, so the x-axis is a real
// timeline with visible gaps rather than a list of the days that happened to
// sell. For a bounded window the axis is the window; for an open-ended one it
// runs to today (or to the last sale, whichever is later).
export const byDay = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  returns: v.array(
    v.object({
      dayMs: v.number(),
      count: v.number(),
      gross: v.number(),
      editions: v.array(v.object({ lang: v.string(), count: v.number(), gross: v.number() })),
    }),
  ),
  handler: async (ctx, { from, to }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");

    const inWindow = await ctx.db
      .query("ledger")
      .withIndex("by_creation_time", (q) => {
        if (from !== undefined && to !== undefined) return q.gte("_creationTime", from).lt("_creationTime", to);
        if (from !== undefined) return q.gte("_creationTime", from);
        if (to !== undefined) return q.lt("_creationTime", to);
        return q;
      })
      .collect();
    const sales = salesOnly(inWindow);
    if (sales.length === 0) return [];

    // day index -> lang -> running { gross, count }.
    const byDayLang = new Map<number, Map<string, { gross: number; count: number }>>();
    for (const r of sales) {
      const d = Math.floor(r._creationTime / DAY);
      const langs = byDayLang.get(d) ?? new Map();
      const agg = langs.get(r.lang) ?? { gross: 0, count: 0 };
      agg.gross += r.gross;
      agg.count += 1;
      langs.set(r.lang, agg);
      byDayLang.set(d, langs);
    }

    const soldDays = [...byDayLang.keys()];
    const firstSale = Math.min(...soldDays);
    const lastSale = Math.max(...soldDays);
    // A `to` past the last sale would only add trailing empty days to a custom
    // range, so a bounded window stops at its last sale.
    const endDay =
      to !== undefined ? Math.min(Math.floor((to - 1) / DAY), lastSale) : Math.max(Math.floor(Date.now() / DAY), lastSale);
    const wanted = from !== undefined ? Math.floor(from / DAY) : firstSale;
    const startDay = Math.max(wanted, endDay - DAY_CAP + 1);

    const out: { dayMs: number; count: number; gross: number; editions: { lang: string; count: number; gross: number }[] }[] =
      [];
    for (let d = startDay; d <= endDay; d++) {
      const editions = [...(byDayLang.get(d) ?? new Map()).entries()].map(([lang, agg]) => ({
        lang,
        count: agg.count,
        gross: agg.gross,
      }));
      out.push({
        dayMs: d * DAY,
        count: editions.reduce((sum, e) => sum + e.count, 0),
        gross: editions.reduce((sum, e) => sum + e.gross, 0),
        editions,
      });
    }
    return out;
  },
});
