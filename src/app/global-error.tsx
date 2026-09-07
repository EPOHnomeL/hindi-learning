"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { initializePostHog } from "./PostHogClient";
import { claimChunkReload, isChunkLoadError, sessionStore } from "~/lib/chunk-error";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  // A chunk that failed to load is not a broken page, it is a page whose code
  // never arrived (see src/lib/chunk-error.ts). `reset()` cannot cure that: it
  // re-renders the same tree and re-requests the same missing chunk, which is
  // why two users on my-course.app sat on a dead page. Reloading the document
  // does cure it, so do that for them, once per tab.
  const chunk = isChunkLoadError(error);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const reloading = claimChunkReload(error, sessionStore());
    if (initializePostHog()) {
      // Keep reporting it: a chunk failure we recovered from is still worth
      // counting, and the two properties are how the PostHog inbox tells a
      // recovered reload from a page that stayed dead.
      posthog.captureException(error, { chunk_load_error: chunk, auto_reloaded: reloading });
    }
    if (!reloading) return;
    setRecovering(true);
    // A beat before the reload, so the exception request has a chance to leave
    // the tab. No cleanup: the reload tears the document down anyway, and
    // clearing the timer would make React's double-invoked development effect
    // cancel the very recovery it is meant to exercise.
    setTimeout(() => window.location.reload(), 250);
  }, [error, chunk]);

  return (
    <html lang="en">
      <body>
        <main>
          {recovering ? (
            <>
              <h1>Reloading</h1>
              <p>A new version of the app is available. Fetching it now.</p>
            </>
          ) : (
            <>
              <h1>Something went wrong</h1>
              <p>Please try again.</p>
              {/* A chunk error retries by fetching the document again, never by
                  re-rendering: `reset()` would ask for the same missing file. */}
              <button onClick={chunk ? () => window.location.reload() : reset}>Try again</button>
            </>
          )}
        </main>
      </body>
    </html>
  );
}
