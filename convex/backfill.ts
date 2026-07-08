import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertAdmin } from "./lib";
import { shuffleQuizOptions } from "./quizShuffle";

// One-shot, secret-gated backfill: reshuffle the option order of every stored
// quiz so the correct answer is no longer clustered at the first position (the
// authoring model's tell). Covers the source lessons AND every translated
// lesson Edition (translations of kind "lesson"). `shuffleQuizOptions` is
// deterministic and idempotent, so re-running this is safe and a no-op once
// applied. Future lessons are shuffled at publish time (scripts/publish.ts) and
// future translations inherit the shuffled source, so this only fixes existing
// rows.
//
// Paginated a page at a time (the translations table grows with Editions), with
// the cursor threaded by the driver `pnpm run backfill-quiz-shuffle[:prod]`.
export const backfillQuizShuffle = mutation({
  args: {
    secret: v.string(),
    table: v.union(v.literal("lessons"), v.literal("translations")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({ patched: v.number(), isDone: v.boolean(), cursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, { secret, table, cursor }) => {
    assertAdmin(secret);

    const page = await ctx.db.query(table).paginate({ cursor, numItems: 100 });
    let patched = 0;
    for (const row of page.page) {
      // translations covers every artifact kind; only lesson bodies carry quizzes.
      if ("kind" in row && row.kind !== "lesson") continue;
      const html = row.html;
      if (html === undefined) continue;
      const shuffled = shuffleQuizOptions(html);
      if (shuffled !== html) {
        await ctx.db.patch(row._id, { html: shuffled });
        patched++;
      }
    }
    return { patched, isDone: page.isDone, cursor: page.continueCursor };
  },
});
