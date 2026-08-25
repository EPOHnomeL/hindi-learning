import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import type { ConvexCredentialsConfig } from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { ACCESS_CODE_PROVIDER_ID, normaliseAccessCode, normaliseNickname, seatAccountId } from "./accessCodeFormat";
import { ACCESS_ERRORS, accessRefusal } from "./accessCodes";

// The **Access Code credentials provider** (ADR 0031, shared-access-codes tickets
// 03, 04 and 10): a member types a code, a nickname of their own choosing and a
// PIN, and is signed in to a Seat. No email is asked for at any point.
//
// **It is `ConvexCredentials`, not `Password`, and that is not a preference.**
// `Password` derives its account identity from `profile.email` and writes into
// `users.email` and the `email` index, which would collide with real accounts and
// with this repo's custom `createOrUpdateUser`. `ConvexCredentials` is the
// primitive `Password` is itself built from, and it takes an account id and a
// secret directly. This module is a deliberately close read of
// `@convex-dev/auth/providers/Password`, minus the email.
//
// **The PIN is never stored by us.** It is the `secret` handed to `createAccount`,
// hashed with Lucia's scrypt exactly as `Password` hashes a password, and it lands
// in `authAccounts`. Nothing in the `seats` table can verify a PIN, by
// construction. The `crypto` block below is what does that hashing, and without it
// the library refuses to store a secret at all.
//
// **There is a `flow`, and it is load-bearing.** `Password` has `signUp`/`signIn`;
// this has `join`/`return`, for a sharper reason than symmetry. A code plus an
// existing nickname plus a wrong PIN is *the same request* whether the member
// believes they are new or coming back, so without a declared intent
// `access/nickname-taken` and `access/pin-wrong` cannot be distinguished at all,
// and the spec requires that they be. A member who declared "join" and hit a taken
// nickname needs "pick another"; a member who declared "return" needs "that does
// not match a seat on this code".
//
// **There is no reset flow and there must never be one.** A reset needs a second
// channel and the second channel is the email this whole design exists to avoid.
// `/join` says in those words that a forgotten PIN cannot be recovered by anybody,
// and that statement has to stay true. `changePin` below is a CHANGE: it demands
// the old PIN, because the only thing that proves a caller owns a Seat is the PIN,
// and a change that does not require it is a takeover.

// Four digits minimum, and the join page says so. Not a password: it is typed on a
// phone in a room full of people, so length is traded for a member who can actually
// use it, and the trade is paid for by the rate limit the library applies per
// account (see `retrieveAccount`, which is why the return path goes through it).
const MIN_PIN_LENGTH = 4;
// A ceiling only so that a paste of a whole document is not hashed.
const MAX_PIN_LENGTH = 64;
// Long enough for a handle somebody wants, short enough that the account id stays
// an index key rather than an essay.
const MAX_NICKNAME_LENGTH = 40;

// What the member typed, folded into what is stored and looked up.
//
// The two malformed-input cases (an empty nickname, a PIN under four digits) throw
// PLAIN errors rather than tagged ones, unlike every member-facing refusal in this
// rail. That is deliberate: `/join` cannot submit either of them, so the only way
// to reach these is a direct call, and a member never sees the redacted "Server
// Error" a plain throw becomes. Tags are for the distinctions a real member has to
// act on, and adding two more would blur what that set is for.
function credentials(params: Record<string, unknown>) {
  const code = normaliseAccessCode(String(params.code ?? ""));
  const nicknameKey = normaliseNickname(String(params.nickname ?? ""));
  const pin = String(params.pin ?? "");
  if (!nicknameKey || nicknameKey.length > MAX_NICKNAME_LENGTH) throw new Error("pick a nickname");
  assertPin(pin);
  return { code, nicknameKey, pin };
}

// One place, because a PIN is set at join and reset by `changePin`, and a length rule
// enforced at only one of them lets a member end up with a credential the other half
// of the rail will not accept.
function assertPin(pin: string): void {
  if (pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) {
    throw new Error(`a PIN is at least ${MIN_PIN_LENGTH} characters`);
  }
}

// The library's own failures, translated into this rail's tags. `retrieveAccount`
// throws an `Error` whose message is one of three literals
// (`retrieveAccountWithCredentials.ts`); everything else is a real fault and is
// rethrown rather than reported to the member as a wrong PIN.
//
// `InvalidAccountId` and `InvalidSecret` both become `pin-wrong`, and the
// conflation is the point on the RETURN path: "the nickname and PIN you typed do
// not match a seat on this code" is one thing to fix and one sentence to read. The
// nickname's existence is already discoverable through the JOIN path, so nothing is
// being protected by splitting them here, and a second tag would only make the page
// say two things where a member needs one.
function signInFailure(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message === "TooManyFailedAttempts") throw accessRefusal(ACCESS_ERRORS.tooManyAttempts);
  if (message === "InvalidSecret" || message === "InvalidAccountId") {
    throw accessRefusal(ACCESS_ERRORS.pinWrong);
  }
  throw error;
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
    const { code, nicknameKey, pin } = credentials(params as Record<string, unknown>);
    const flow = params.flow === "return" ? "return" : "join";

    const found = await ctx.runQuery(internal.accessCodes.forJoin, { code, nicknameKey });
    // Distinguishable from every other refusal on purpose: a member who mistyped
    // needs to try again, and a member holding a dud needs to go back to whoever
    // gave it to them. One message for both is the one that helps neither.
    if (!found) throw accessRefusal(ACCESS_ERRORS.codeUnknown);
    const account = { id: seatAccountId(found.accessCodeId, nicknameKey), secret: pin };

    if (flow === "return") {
      // **A stopped or full code still admits an existing Seat**, and neither is
      // checked here. Stopping ends the agreement, not what a member was already
      // given, and a full code is full of seats that all still have to work.
      if (!found.seatExists) throw accessRefusal(ACCESS_ERRORS.pinWrong);
      const retrieved = await retrieveAccount(ctx, {
        provider: ACCESS_CODE_PROVIDER_ID,
        account,
      }).catch(signInFailure);
      // No seat is consumed, no row is written, and nothing about the code is
      // touched. That is the whole of "returning does not cost the organisation a
      // second seat", and it is true because this branch does nothing at all.
      return { userId: retrieved.user._id };
    }

    // Joining. Ordered so the member is told the most actionable thing first: a
    // nickname they can change, before a code state they cannot.
    if (found.seatExists) throw accessRefusal(ACCESS_ERRORS.nicknameTaken);
    if (found.stopped) throw accessRefusal(ACCESS_ERRORS.codeStopped);
    if (found.full) throw accessRefusal(ACCESS_ERRORS.codeFull);

    // The `users` row is created with NO email field at all, by the branch at the
    // top of `auth.ts`'s `createOrUpdateUser`. That branch is trap 1 from vouchers
    // ticket 11 and it is not optional: without it this insert lands `email: ""` and
    // the SECOND member to join signs in as the first.
    const { user } = await createAccount(ctx, {
      provider: ACCESS_CODE_PROVIDER_ID,
      account,
      profile: {},
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    // The cap, the Seat and the Entitlement, in one transaction. If this throws
    // (the last seat went to somebody else between the read above and here) the
    // account exists and grants nothing: no Seat, no Entitlement, no access. A
    // retry once the organisation raises the cap re-enters `createAccount`, which
    // returns the same account for a matching secret, and completes.
    await ctx.runMutation(internal.accessCodes.claimSeat, {
      accessCodeId: found.accessCodeId,
      userId: user._id,
      nicknameKey,
      consentVersion: String(params.consentVersion ?? ""),
    });
    return { userId: user._id };
  },
  // **Required rather than decorative.** With no `crypto` block the library
  // refuses to hash at all (`provider.ts` throws on an absent `hashSecret`), so
  // this is the whole of what stands between a member's PIN and being stored as it
  // was typed.
  //
  // Lucia's scrypt, character for character what `Password` uses. It is imported
  // directly rather than borrowed off a `Password()` config, because the config
  // object hides its real fields under an internal `options` key that the library
  // marks `@ts-expect-error Internal`, and reaching through that to save a
  // dependency line is a clever thing that breaks on a patch release. `lucia` is a
  // direct dependency for this one import.
  crypto: {
    async hashSecret(secret: string) {
      return await new Scrypt().hash(secret);
    },
    async verifySecret(secret: string, hash: string) {
      return await new Scrypt().verify(hash, secret);
    },
  },
});

// Change the PIN on the caller's own Seat (ticket 10).
//
// A member types four digits on a phone, in a room full of people, at a party
// meeting. Being unable to change it afterwards makes the credential worse than it
// looks, so this exists. What it is **not** is a reset: there is no recovery path on
// this rail and this must never accidentally create one.
//
// Three things hold it shut:
//
//   - **It demands the old PIN.** The only thing that proves a caller owns a Seat is
//     the PIN, so a change that skips it is a takeover, and on this rail there is no
//     email to send a warning to afterwards.
//   - **It takes no seat argument.** The Seat comes from `ctx.auth` through
//     `internal.accessCodes.mySeatAccount`, so there is no id a caller could pass to
//     change somebody else's PIN.
//   - **It shares sign-in's rate limit.** The old-PIN check goes through
//     `retrieveAccount`, which is where the library's per-account limiter lives, so
//     this is not a way around ticket 04's limit. Guessing a PIN here costs exactly
//     what guessing it at the sign-in box costs.
//
// An **action**, not a mutation, because `modifyAccountCredentials` hashes the new
// secret and no mutation can call it.
export const changePin = action({
  args: { oldPin: v.string(), newPin: v.string() },
  returns: v.null(),
  handler: async (ctx, { oldPin, newPin }) => {
    const seat = await ctx.runQuery(internal.accessCodes.mySeatAccount, {});
    // A Guest and an ordinary email-and-password account both land here: neither
    // holds a Seat, so there is no PIN of theirs to change.
    if (!seat) throw new Error("you do not hold a seat on an access code");
    assertPin(newPin);
    const account = { id: seatAccountId(seat.accessCodeId, seat.nicknameKey) };
    await retrieveAccount(ctx, {
      provider: ACCESS_CODE_PROVIDER_ID,
      account: { ...account, secret: oldPin },
    }).catch(signInFailure);
    // The library rehashes. Nothing in `seats` changes, so the Seat, its consent
    // record, its Entitlement and its progress are all untouched by construction.
    await modifyAccountCredentials(ctx, {
      provider: ACCESS_CODE_PROVIDER_ID,
      account: { ...account, secret: newPin },
    });
    return null;
  },
});
