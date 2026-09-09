// **Which Edition of a course do we mean?** One ladder, asked by both sides.
//
// Surfaced by the 2026-09-08 architecture walk. It was spelled five times: three
// byte-identical copies in `Dashboard.tsx` (`SharedCourseCard`,
// `PurchasedCourseCard`, `AvailableCourseCard`), each with a comment saying it
// mirrors one of the others, and two on the server (`shares.ts`, `market.ts`)
// computing the card TITLE from the same ladder minus its top rung.
//
// A plain module with one import, so both the Convex functions and the client
// components can take it, the way `languages.ts` is shared.
import { SOURCE_LANG } from "./sourceLang";

// The Edition to open, or to title a card in. `undefined` when the caller holds
// no Edition at all, which is a real state for a card mid-revocation.
//
// The rungs, in order:
//
//   1. `locale`, when the caller holds that Edition. Reading a course in the
//      language the app is already in beats reading it in English.
//   2. The source Edition, when they hold it.
//   3. Whatever they hold first.
//
// **`locale` is optional, and its absence is the honest difference between the
// two sides rather than a copy that drifted.** The server queries that title a
// card have no idea what UI language the browser is in, so they ask without the
// top rung. One consequence is worth knowing and is NOT fixed here: a Viewer
// whose UI locale is Spanish and who holds both Editions sees a card titled in
// English that opens in Spanish. Fixing that means passing the locale into
// `listSharedTopics` and `myPurchases`, which is a change to what those queries
// take rather than a tidy-up of how they decide, so it wants its own ticket.
export function preferEdition(langs: readonly string[], locale?: string): string | undefined {
  if (locale !== undefined && langs.includes(locale)) return locale;
  if (langs.includes(SOURCE_LANG)) return SOURCE_LANG;
  return langs[0];
}
