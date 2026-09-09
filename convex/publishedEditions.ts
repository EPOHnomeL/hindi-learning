// The **Catalogue** listing, read three ways: which Editions a course has listed,
// which of those actually exist, and which of those are free to read.
//
// Split out of `edition.ts` on 2026-09-08 (ticket 28). It reads
// `publishedEditions`, `translationJobs` and `listings`, and it answers nothing
// about a caller, so it sits BELOW the grant walk rather than beside the reader:
// `grants.ts` needs `freePublishedLangs`, and leaving the trio in `edition.ts`
// (which imports `grants.ts`) would have made the two modules import each other.
// That circular-import trap has bitten this repo twice already, in tickets 16 and
// 18, both times through a helper left one module too high up.
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { SOURCE_LANG } from "./sourceLang";

// The Editions a course has listed in its tenant's catalogue
// (`publishedEditions`, course-publishing): `published: true` rows only, since an
// absent row and `published: false` both read as unlisted.
export async function publishedLangs(ctx: QueryCtx, topicId: Id<"topics">): Promise<Set<string>> {
  const rows = await ctx.db
    .query("publishedEditions")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .collect();
  return new Set(rows.filter((r) => r.published).map((r) => r.lang));
}

// The listed Editions that actually exist, which is what the catalogue may
// advertise. A listed language whose translation has since been removed (or never
// finished) is not an Edition at all, so serving it would mean English text under
// a foreign-language label; publishing enforces that create-side, and this
// re-checks it because an Edition can go away after being listed.
export async function livePublishedLangs(ctx: QueryCtx, topicId: Id<"topics">): Promise<Set<string>> {
  const langs = await publishedLangs(ctx, topicId);
  if (![...langs].some((l) => l !== SOURCE_LANG)) return langs;
  const jobs = await ctx.db
    .query("translationJobs")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .collect();
  const ready = new Set(jobs.filter((j) => j.status === "ready").map((j) => j.lang));
  for (const l of langs) if (l !== SOURCE_LANG && !ready.has(l)) langs.delete(l);
  return langs;
}

// The listed Editions that are free to read, which is what publishing actually
// opens up: `livePublishedLangs` minus the PRICED ones (a paid Edition is bought,
// never read for free, and only its Preview shows).
export async function freePublishedLangs(ctx: QueryCtx, topicId: Id<"topics">): Promise<Set<string>> {
  const langs = await livePublishedLangs(ctx, topicId);
  if (langs.size === 0) return langs;
  const priced = await ctx.db
    .query("listings")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .collect();
  for (const l of priced) langs.delete(l.lang);
  return langs;
}
