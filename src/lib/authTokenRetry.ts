// Surviving a dropped network during a Convex auth token refresh.
//
// Where production's "TypeError: Failed to fetch" actually came from (read off the
// minified frames on 2026-09-18, since no source map covered them): the Convex Auth
// Next.js client refreshes a signed-in learner's JWT by POSTing to `/api/auth`, and
// the Convex client schedules that refresh with a bare `void this.refetchToken()`
// (convex 1.41.0, browser/sync/authentication_manager.js). Nothing on either side
// catches a rejected fetch, so a network blip at refresh time surfaces as an
// unhandled rejection with no first-party frame, filed as a crash. Worse than the
// noise: on the reauthentication path the client has already stopped its socket
// before the fetch, so a rejection there leaves the tab with no live connection
// until the learner reloads.
//
// This wraps the token fetcher the auth provider hands the client. A rejection is
// retried after each delay; when the delays are spent it resolves `null`, which the
// Convex client treats as "no token" and handles cleanly (it clears auth, reports
// signed-out, and restarts the socket), and the failure is reported once through
// `onGiveUp` so it stays visible under a name that can be triaged.

export type TokenFetcher = (args: { forceRefreshToken: boolean }) => Promise<string | null | undefined>;

export interface RetryOptions {
  // One entry per retry, in milliseconds. Empty means one attempt and no retry.
  delaysMs: number[];
  // Injected so the test never waits on a real clock.
  sleep?: (ms: number) => Promise<void>;
  // Called once, after the last attempt has failed. Must not be relied on to throw.
  onGiveUp: (error: unknown, attempts: number) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function retryingTokenFetcher(
  fetchToken: TokenFetcher,
  { delaysMs, sleep = defaultSleep, onGiveUp }: RetryOptions,
): TokenFetcher {
  return async (args) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchToken(args);
      } catch (error) {
        const delay = delaysMs[attempt];
        if (delay === undefined) {
          // The reporter is a side channel; a failure in it must not turn the
          // give-up back into the very rejection this exists to prevent.
          try {
            onGiveUp(error, attempt + 1);
          } catch {
            // deliberately swallowed, see above
          }
          return null;
        }
        await sleep(delay);
      }
    }
  };
}

// The give-up is reported under its own name, not as the raw `TypeError: Failed
// to fetch` it wraps. Verified in PostHog on 2026-09-21: since the retry shipped
// (1883ad6, live from 2026-09-18) every unhandled "Failed to fetch" has come from
// a bundle that no longer exists on the deploy, and the one post-fix occurrence
// was this handled report, filed into the *same* error-tracking issue as the
// crash because the type and message are identical. That kept a fixed crash
// showing as active and high severity, and made "the retry worked and told us"
// unreadable against "a learner's tab died". A distinct name and message splits
// them, and the stack now points at first-party code instead of a minified
// vendor frame with no source map.
export class AuthTokenRefreshFailed extends Error {
  constructor(
    readonly attempts: number,
    cause: unknown,
  ) {
    super(`Convex auth token refresh failed after ${attempts} attempt(s)`, { cause });
    this.name = "AuthTokenRefreshFailed";
  }
}
