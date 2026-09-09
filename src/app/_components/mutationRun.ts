"use client";

import { ConvexError } from "convex/values";
import { useCallback, useState } from "react";

// **Running a mutation from a control**: the busy flag, the error slot, the
// try/catch/finally, and the one correct way to read a server refusal.
//
// Ticket 32 (candidate 8 of the 2026-09-04 architecture review). The review
// counted 42 busy flags, 27 error slots and three mutually incompatible error
// interfaces across the client, with no shared implementation anywhere. Two
// consequences, both behavioural rather than cosmetic:
//
//   - **The unwrap had been re-learned from separate production incidents.**
//     `AdminPanel.tsx` recorded the first, `ArtifactView.tsx` a second dated
//     2026-08-05, and `JoinPanel.tsx` and `RedeemPanel.tsx` were copies three and
//     four. `manage/VoucherCard.tsx` knew the rule and gave up on it.
//   - **Seven call sites discarded the server's refusals entirely**, having a
//     `finally` and no `catch`. The server wrote a carefully worded refusal and
//     the user saw nothing at all.
//
// This is a hook and two pure functions, not a component. How a control DISPLAYS
// a message is the component vocabulary's business (ticket 03); where the message
// comes from is this module's.

// ---- reading a refusal ----------------------------------------------------------

// The refusal tag the server threw, or `""` when this was not a tagged refusal.
//
// **A production Convex deployment redacts a plain `Error`'s message** before it
// reaches the client: `e.message` is then the useless "[CONVEX M(...)] Server
// Error" string. Only a `ConvexError`'s `data` survives the trip, which is the
// fact four separate call sites each learned the hard way.
//
// The two panels that map a tag onto localised copy (`JoinPanel`, `RedeemPanel`)
// want exactly this and then their own `switch`, because which message a member
// needs is per-panel and rightly so.
export function refusalTag(e: unknown): string {
  return e instanceof ConvexError && typeof e.data === "string" ? e.data : "";
}

// The message to show when a mutation refuses: the server's tag if it sent one, a
// genuinely local failure's own message if it has one, else the caller's
// fallback.
//
// The middle case is what `ArtifactView`'s copy added and `AdminPanel`'s did not:
// an upload PUT that fails throws locally with an already-localised message, and
// showing the caller's generic fallback there loses real information. The
// `[CONVEX` test is what keeps a redacted server error out of the UI.
//
// Two exclusions from that middle case, both of which the copies got wrong and
// the tests for this module caught on the way in:
//
//   - **A `ConvexError` is an `Error`**, and when its `data` is an object its
//     `message` is that object's JSON. The old copies fell through to it and
//     would have printed `{"code":"nope"}` into the UI.
//   - **An empty message is not a message.** A control that renders
//     `error && <p>{error}</p>` would show nothing at all, which reads as
//     success.
export function refusalMessage(e: unknown, fallback: string): string {
  const tag = refusalTag(e);
  if (tag) return tag;
  if (e instanceof ConvexError) return fallback;
  if (e instanceof Error && e.message !== "" && !/\[CONVEX/.test(e.message)) return e.message;
  return fallback;
}

// ---- running one ----------------------------------------------------------------

export type MutationRun<Args, Ret> = {
  // Runs it. Resolves to the mutation's value, or `undefined` when it refused,
  // so a caller can branch without a second try/catch.
  run: (args: Args) => Promise<Ret | undefined>;
  busy: boolean;
  error: string | null;
  // Clear the message. Call it when the user edits the field the refusal was
  // about, so a stale refusal does not sit under a form they have since fixed.
  reset: () => void;
};

// One control, one mutation, the whole dance.
//
// `message` is either a fallback string or a function from the thrown value to
// the message, which is how a panel with a tag-to-copy `switch` uses the same
// hook as a button with one generic fallback.
export function useMutationRun<Args, Ret>(
  fn: (args: Args) => Promise<Ret>,
  message: string | ((e: unknown) => string),
): MutationRun<Args, Ret> {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (args: Args): Promise<Ret | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await fn(args);
      } catch (e) {
        // The `catch` is the point. A control cannot opt out of surfacing a
        // refusal by forgetting to write one, which is how seven call sites came
        // to swallow every message the server sent them.
        setError(typeof message === "function" ? message(e) : refusalMessage(e, message));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [fn, message],
  );

  const reset = useCallback(() => setError(null), []);
  return { run, busy, error, reset };
}
