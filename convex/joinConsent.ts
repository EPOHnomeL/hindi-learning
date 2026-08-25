// The **consent wording** a member agrees to before taking a Seat, versioned
// (ADR 0031, shared-access-codes tickets 03 and 09).
//
// A plain module with no Convex functions registered in it, like
// `accessCodeFormat.ts` beside it, so the `/join` page and the credentials
// provider resolve the same version from the same place. `convex/` has its own
// tsconfig and never imports from `src/`, so this has to live here rather than
// under `src/lib/` for the server half to see it.
//
// **Why a version at all.** POPIA s27(1)(a) consent is the entire legal basis for
// this rail, and s11(2) puts the burden of proving it on us. A year from now the
// question will be *which wording* a particular member agreed to, and
// `seats.consentVersion` is only worth storing if something on the other end
// resolves it. That something is this module.
//
// **The English below is the record.** `/join` renders the member's own language
// (messages/*.json, `Join.consent*`) because consent has to be *informed* and a
// member reading Afrikaans cannot be informed by English. But a translation can be
// revised for phrasing, and the thing we may one day have to produce is the exact
// undertaking given. So the canonical text is frozen here, in one language, and
// the translations are for comprehension.
//
// **Append only.** A new version is a new key. Editing an existing entry rewrites
// what a member who already joined is recorded as having agreed to, which is the
// one thing this module exists to prevent.

export const CONSENT_VERSIONS: Record<string, readonly string[]> = {
  // 2026-08-23, the wording this rail shipped with.
  //
  // "Specific" means naming what is stored and why. "Informed" means saying who
  // can see it and who cannot. Both are POPIA's words, and a pre-ticked box or a
  // line buried in the terms discharges neither.
  "2026-08-23": [
    "To take this course we store three things: the nickname you choose, a PIN you choose, and which lessons you have opened and completed.",
    "Your nickname does not have to be your real name, and we would rather it was not. We never ask for your email address, your phone number, or your name.",
    "We store this so that you can come back to the course on another phone and pick up where you left off. That is the only reason.",
    "The organisation that paid for your place, and the person who wrote the course, are shown how many people joined. They are never shown your nickname or anything else about you.",
    "Your PIN is stored scrambled, so nobody here can read it. If you forget it, nobody can recover it for you, and your progress is gone. Write it down.",
    "You can ask us to delete what we hold at any time, and you keep your access to the course.",
  ],
} as const;

// The version a join taken today is recorded against. `/join` sends this and the
// server refuses anything else, so a stale cached page cannot record a member as
// having agreed to wording it never showed them.
export const CONSENT_VERSION = "2026-08-23";
