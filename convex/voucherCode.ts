// The voucher **code** itself: how one is minted and how one typed by a member is
// folded back into the stored form (the seller-minted voucher rail, ADR 0029).
//
// A plain module with no Convex functions registered in it, like `sellerStatus.ts`
// - which is what lets the `/redeem` page import `normaliseCode` and echo the
// normalised code back as the member types, without dragging a server module into
// the browser bundle.

// 32 characters: A-Z and 2-9 minus `O`, `I`, `0` and `1`. A code is read down a
// phone, copied off a printed card, and typed by somebody who has never seen this
// platform - so the pairs that collide by sight are simply not in the alphabet.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// `MYC-7K4Q-2XR9` - one fixed group and two random ones. The prefix is not
// entropy; it makes a code recognisable as one when it turns up out of context in
// a group chat. 32^8 is about 1.1e12 codes, so a collision is vanishingly
// unlikely - and minting retries on one anyway rather than throwing, because a
// clash is the platform's problem and must never cost the Seller their batch.
const CODE_PREFIX = "MYC";

export function mintCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `${CODE_PREFIX}-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

// Fold whatever the member typed into the stored form: upper-cased, with the
// separators re-derived rather than trusted, so `myc7k4q2xr9`, `myc 7k4q 2xr9` and
// `MYC-7K4Q-2XR9` are all one code. They are reading it off a card or a phone
// screen with no instructions, and a code that "does not exist" because of a
// stray space is indistinguishable to them from a dud one.
//
// Exported for the `/redeem` page, which echoes the normalised form back as they
// type so that the thing they see is the thing being looked up.
export function normaliseCode(raw: string): string {
  const bare = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return [bare.slice(0, 3), bare.slice(3, 7), bare.slice(7, 11)].filter((g) => g.length > 0).join("-");
}

