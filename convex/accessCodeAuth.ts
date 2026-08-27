import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount } from "@convex-dev/auth/server";
import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { ACCESS_CODE_PROVIDER_ID, normaliseAccessCode, normaliseNickname, seatAccountId } from "./accessCodeFormat";
import { ACCESS_ERRORS, accessRefusal } from "./accessCodes";

// The **Access Code credentials provider** (ADR 0031, shared-access-codes tickets
// 03 and 04; reshaped 2026-08-27): a member types a code and their name, and is
// signed in to a Seat. A name the code has not seen takes a new seat; a name it has
// signs back into the seat that name already holds. No email is asked for at any
// point, and since 2026-08-27 no PIN either.
//
// **It is `ConvexCredentials`, not `Password`, and that is not a preference.**
// `Password` derives its account identity from `profile.email` and writes into
// `users.email` and the `email` index, which would collide with real accounts and
// with this repo's custom `createOrUpdateUser`. `ConvexCredentials` is the
// primitive `Password` is itself built from, and it takes an account id directly.
//
// **The PIN went on 2026-08-27, by the owner's explicit call**, and with it the
// `join`/`return` flow declaration, the scrypt `crypto` block, the rate limiter and
// `changePin`. One box, one button: the flow declaration existed only because a
// wrong PIN was ambiguous between "nickname taken" and "PIN wrong", and with no PIN
// there is nothing to be ambiguous about. What that costs is stated in
// `accessCodes.ts` at ACCESS_ERRORS: **the name is the whole credential**, so
// anybody holding the code can enter any member's seat by typing their name. The
// owner accepted that trade for this audience.
//
// **Sign-back-in never touches `authAccounts`.** `forJoin` returns the userId the
// name's Seat already points at and `authorize` returns it directly, so a seat
// created in the PIN era (its account row still carries a scrypt hash nobody can
// type) signs in by name exactly like a new one. No migration, nothing to reset.

// Long enough for a real name and surname, short enough that the account id stays
// an index key rather than an essay.
const MAX_NICKNAME_LENGTH = 40;

// What the member typed, folded into what is stored and looked up.
//
// The malformed-input case (an empty name) throws a PLAIN error rather than a
// tagged one, unlike every member-facing refusal in this rail. That is deliberate:
// `/join` cannot submit it, so the only way to reach it is a direct call, and a
// member never sees the redacted "Server Error" a plain throw becomes.
function credentials(params: Record<string, unknown>) {
  const code = normaliseAccessCode(String(params.code ?? ""));
  const nicknameKey = normaliseNickname(String(params.nickname ?? ""));
  if (!nicknameKey || nicknameKey.length > MAX_NICKNAME_LENGTH) throw new Error("type your name");
  return { code, nicknameKey };
}

// **The type annotation is not optional.** `authorize` reaches for
// `internal.accessCodes.*`, `_generated/api` is built from `typeof` every module in
// `convex/`, and this module is one of them, so an inferred type here is a cycle
// that TypeScript resolves by making the WHOLE generated api `any`. It fails
// nowhere near here: the first symptom is a hundred implicit-any errors in
// `src/app/_components/*.tsx`.
export const AccessCode: ConvexCredentialsConfig = ConvexCredentials<DataModel>({
  id: ACCESS_CODE_PROVIDER_ID,
  authorize: async (params, ctx) => {
    const { code, nicknameKey } = credentials(params as Record<string, unknown>);

    const found = await ctx.runQuery(internal.accessCodes.forJoin, { code, nicknameKey });
    // Distinguishable from every other refusal on purpose: a member who mistyped
    // needs to try again, and a member holding a dud needs to go back to whoever
    // gave it to them. One message for both is the one that helps neither.
    if (!found) throw accessRefusal(ACCESS_ERRORS.codeUnknown);

    // **A known name signs back in, before any code-state check.** A stopped or
    // full code still admits an existing Seat: stopping ends the agreement, not
    // what a member was already given, and a full code is full of seats that all
    // still have to work. No seat is consumed, no row is written, and nothing
    // about the code is touched, which is the whole of "returning does not cost
    // the organisation a second seat".
    if (found.seatUserId) return { userId: found.seatUserId };

    // Joining. Ordered so the member is told the most actionable thing first.
    if (found.stopped) throw accessRefusal(ACCESS_ERRORS.codeStopped);
    if (found.full) throw accessRefusal(ACCESS_ERRORS.codeFull);

    // The `users` row is created with NO email field at all, by the branch at the
    // top of `auth.ts`'s `createOrUpdateUser`. That branch is trap 1 from vouchers
    // ticket 11 and it is not optional: without it this insert lands `email: ""` and
    // the SECOND member to join signs in as the first.
    //
    // **No `secret`.** The library hashes and verifies only when one is passed, so
    // no `crypto` block is needed, and a retry that re-enters `createAccount` for an
    // account that already exists (see below) gets the existing row back without a
    // secret to match.
    const { user } = await createAccount(ctx, {
      provider: ACCESS_CODE_PROVIDER_ID,
      account: { id: seatAccountId(found.accessCodeId, nicknameKey) },
      profile: {},
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    // The cap, the Seat and the Entitlement, in one transaction. If this throws
    // (the last seat went to somebody else between the read above and here) the
    // account exists and grants nothing: no Seat, no Entitlement, no access. A
    // retry once the organisation raises the cap re-enters `createAccount`, which
    // returns the same account, and completes.
    await ctx.runMutation(internal.accessCodes.claimSeat, {
      accessCodeId: found.accessCodeId,
      userId: user._id,
      nicknameKey,
      consentVersion: String(params.consentVersion ?? ""),
    });
    return { userId: user._id };
  },
});
