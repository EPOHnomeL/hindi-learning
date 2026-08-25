// The **Access Code** string itself: how one is minted and how one typed by a
// member is folded back into the stored form (the shared capped code rail,
// [[ADR 0031]]).
//
// A plain module with no Convex functions registered in it, the same shape
// `voucherCode.ts` has and for the same reason: it lets the `/join` page import
// `normaliseAccessCode` and echo the normalised code back as the member types,
// without dragging a server module into the browser bundle.
//
// Named `accessCodeFormat` rather than `accessCode` on purpose. `accessCodes.ts`
// beside it holds the Convex functions, and two modules differing by one `s`
// is an import somebody gets wrong at 2am.

// The same 32-character alphabet the voucher rail uses (A-Z and 2-9, minus O, I,
// 0 and 1), and for a stronger version of the same reason. A voucher code is read
// off a printed card; an Access Code is **said out loud at a public meeting** and
// typed by everybody in the room, so a pair that collides by sight or by sound is
// not a typo, it is a whole cohort locked out.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// `GRP-7K4-Q2X-9MB` - the prefix plus three groups of three.
//
// **Deliberately a different shape from a Voucher's `MYC-7K4Q-2XR9`**, not just a
// different prefix. Both rails can be live on one Edition at the same time (ADR
// 0031 keeps the voucher rail), so a Seller looking at two codes, or a member
// holding one, must be able to tell which rail they are on at a glance rather than
// by reading three characters.
//
// Groups of THREE because this is the code that gets dictated. Nine characters in
// threes is the phone-number rhythm; the voucher's fours are for copying off a
// card, which is a different job.
//
// 32^9 is about 3.5e13, an order of magnitude more entropy than a voucher's 32^8
// and deliberately so: a voucher grants one seat and dies, while a guessed Access
// Code grants seats up to the cap and bills the organisation for them. Minting
// retries on a collision rather than throwing (see `accessCodes.ts`), because a
// clash is the platform's problem and must never cost the Seller their deal.
const CODE_PREFIX = "GRP";
const CODE_LENGTH = 9;

export function mintAccessCodeString(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return [CODE_PREFIX, chars.slice(0, 3).join(""), chars.slice(3, 6).join(""), chars.slice(6).join("")].join("-");
}

// Fold whatever the member typed into the stored form: upper-cased, with the
// separators re-derived rather than trusted, so `grp7k4q2x9mb`, `grp 7k4 q2x 9mb`
// and `GRP-7K4-Q2X-9MB` are all one code.
//
// This matters more here than on the voucher rail. A member heard this code read
// out in a room, or read it off a WhatsApp message that may have been retyped by
// three people on the way, and a code that "does not exist" because of a stray
// space is indistinguishable to them from a dud one. Exported for `/join`, which
// echoes the normalised form back as they type so the thing they see is the thing
// being looked up.
export function normaliseAccessCode(raw: string): string {
  const bare = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return [bare.slice(0, 3), bare.slice(3, 6), bare.slice(6, 9), bare.slice(9, 12)]
    .filter((g) => g.length > 0)
    .join("-");
}

// Fold a typed nickname into the key the Seat is stored and looked up under:
// trimmed, inner whitespace collapsed, lower-cased.
//
// **This is the account identity**, half of the `${accessCodeId}:${nicknameKey}`
// id the credentials provider hands Convex Auth, so it has to be stable across
// devices and across however carefully somebody typed it. A member who joined as
// `Thandi` on a phone and comes back typing ` thandi ` on a borrowed laptop is the
// same person and must land in the same seat.
//
// It is also the uniqueness rule: two members cannot hold `Thandi` and `thandi` on
// one code, because to everybody in the room those are one nickname and the second
// member would think they were locked out of their own seat.
export function normaliseNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
