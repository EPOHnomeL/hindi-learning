// The source language every course is authored in (the medium the teach skill
// writes). It is the default Edition: `translations` rows exist only for OTHER
// languages, and a Share/pendingShare/Certificate with no `lang` reads as this.
//
// (Plain module, no Convex functions registered here.) It has a module of its
// own, rather than living in `lib.ts` with the rest of the Edition core, because
// both the Edition core and the Share primitives split away from it
// (`shareGrants.ts`) need it: a shared root constant is how that dependency stays
// a one-way edge instead of a cycle between the two modules.
export const SOURCE_LANG = "en";
