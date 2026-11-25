import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { livePublishedLangs } from "./publishedEditions";
import { SOURCE_LANG } from "./sourceLang";

// Which Editions a signed-out visitor can open on the course's own URL,
// `/courses/<slug>`, and the one place every public course link is built.
//
// Since 2026-11-25 the slug entrance opens for an Edition that is live-published
// AND either priced (the shopfront: Preview + paygate, as since 2026-09-08) or
// has its Public link switched on (a free course the owner chose to make public:
// full read). A free published Edition WITHOUT a Public link still asks for an
// account, and an unpublished one is never public here. The `/share/<token>` link
// keeps working for every Edition that has one, published or not.
//
// Sits below edition.ts (reads `listings` directly, like publishedEditions.ts) so
// reader.ts, certificates.ts, translate.ts and public.ts can all import it without
// an import cycle.

// The Edition's Public link is on: English is the legacy per-Topic token, every
// other language its own `publicLinks` row (shares.setEditionPublic).
async function hasPublicLink(ctx: QueryCtx, topic: Doc<"topics">, lang: string): Promise<boolean> {
  if (lang === SOURCE_LANG) return !!topic.publicToken;
  const row = await ctx.db
    .query("publicLinks")
    .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
    .unique();
  return row !== null;
}

async function isPriced(ctx: QueryCtx, topic: Doc<"topics">, lang: string): Promise<boolean> {
  const row = await ctx.db
    .query("listings")
    .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
    .unique();
  return row !== null;
}

// The Editions `/courses/<slug>` serves to a signed-out visitor.
export async function slugOpenLangs(ctx: QueryCtx, topic: Doc<"topics">): Promise<Set<string>> {
  const open = new Set<string>();
  for (const lang of await livePublishedLangs(ctx, topic._id)) {
    if ((await isPriced(ctx, topic, lang)) || (await hasPublicLink(ctx, topic, lang))) open.add(lang);
  }
  return open;
}

// The Edition `/courses/<slug>` serves for a requested `?lang=`: that one when it
// is open, else the English source, else the lowest open code. Null when none is.
export function pickSlugLang(open: Set<string>, requested: string | null): string | null {
  if (requested && open.has(requested)) return requested;
  if (open.has(SOURCE_LANG)) return SOURCE_LANG;
  return [...open].sort()[0] ?? null;
}

// The path a public link to this Edition should carry: the readable course URL
// when it opens there, else the bearer-token link. English needs no `?lang=`
// because the slug entrance falls back to the source Edition whenever it is open.
export async function publicCoursePath(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  lang: string,
  token: string,
): Promise<string> {
  if ((await slugOpenLangs(ctx, topic)).has(lang)) return slugPath(topic, lang);
  return `/share/${encodeURIComponent(token)}`;
}

export function slugPath(topic: Doc<"topics">, lang: string): string {
  const base = `/courses/${encodeURIComponent(topic.slug)}`;
  return lang === SOURCE_LANG ? base : `${base}?lang=${encodeURIComponent(lang)}`;
}
