"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient, useQuery } from "convex/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import posthog from "posthog-js";
import { type ReactNode, useEffect } from "react";
import { ThemeProvider } from "./_components/ThemeContext";
import { TenantProvider } from "./_components/TenantContext";
import { CountryProvider } from "./_components/CountryContext";
import { LocaleSync } from "~/i18n/locale-client";
import type { TenantSlug } from "~/lib/tenant";
import { api } from "../../convex/_generated/api";
import { AuthTokenRefreshFailed, retryingTokenFetcher } from "~/lib/authTokenRetry";
import { isPostHogInitialized } from "./PostHogClient";

// The Convex client refreshes a signed-in learner's token through the fetcher the
// auth provider hands `setAuth`, and it schedules that refresh with a bare `void`,
// so a dropped network at refresh time escaped as an unhandled "Failed to fetch"
// (see src/lib/authTokenRetry.ts for the evidence). Wrapping the fetcher here, at
// the one point every auth path passes through, retries the blip and otherwise
// hands the client a clean `null` it already knows how to handle. A subclass
// rather than a wrapper around the provider: `useAuth`, the hook the Next.js
// provider composes with, is not exported by @convex-dev/auth.
class RetryingAuthConvexClient extends ConvexReactClient {
  setAuth(...args: Parameters<ConvexReactClient["setAuth"]>): void {
    const [fetchToken, ...rest] = args;
    super.setAuth(
      retryingTokenFetcher(fetchToken, {
        delaysMs: [1_000, 2_000, 4_000],
        onGiveUp: (error, attempts) => {
          // Report it under its own name. Capturing the raw TypeError put this
          // handled report in the same error-tracking issue as the unhandled
          // crash it replaces, so the inbox could not tell them apart (see
          // authTokenRetry.ts, verified in PostHog 2026-09-21). The original
          // travels as `cause`.
          if (isPostHogInitialized()) {
            posthog.captureException(new AuthTokenRefreshFailed(attempts, error), {
              auth_token_refresh_failed: true,
              attempts,
            });
          }
        },
      }),
      ...rest,
    );
  }
}

// Next inlines NEXT_PUBLIC_* at build; `npx convex dev` writes it to .env.local.
const convex = new RetryingAuthConvexClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Identifies after Convex has resolved a signed-in account, including on a page
// refresh. `id` is the immutable Convex user document ID, and it is the ONLY
// thing we send: no email, no name, no person properties of any kind.
//
// That is a privacy commitment, not an oversight (2026-09-03). The analytics
// provider holds fault-diagnosis data including what a page looked like, and
// sending an email address alongside it would make every one of those records
// directly identifying at the provider rather than only inside our own
// database. The account reference means nothing without a Convex lookup we
// control. `/privacy` says so in as many words, so do not add properties here
// without changing that page in the same commit.
function PostHogIdentity() {
  const user = useQuery(api.users.me);

  useEffect(() => {
    if (!user || !isPostHogInitialized()) return;

    posthog.identify(user.id);
  }, [user]);

  return null;
}

// `tenantSlug` is resolved once server-side (root layout) and handed down, so the
// client never re-parses the host — one resolution point (issue 10 / 11).
export function ConvexClientProvider({
  tenantSlug,
  country,
  children,
}: {
  tenantSlug: TenantSlug | null;
  // The buyer's `x-vercel-ip-country`, resolved in the root layout — same
  // one-resolution-point rule as the slug (regional pricing, ticket 21).
  country: string | null;
  children: ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {/* Keeps a query's subscription alive for five minutes after its last
          component unmounts (2026-09-21). The plain Convex client drops it the
          instant the last subscriber leaves, so returning to a lesson or the
          dashboard re-asked the server and painted a skeleton over data the
          client held a moment ago. Every `useQuery` in src/ imports from
          convex-helpers/react/cache so it reads through this. The idle ceiling
          bounds what a long session keeps live on a metered connection: a
          course open holds about six queries, so 64 is roughly ten screens. */}
      <ConvexQueryCacheProvider expiration={300_000} maxIdleEntries={64}>
      <CountryProvider country={country}>
        <TenantProvider slug={tenantSlug}>
          {/* Login-sync (ticket 03 §3): seeds the locale cookie from the account's
              stored preference on a fresh device. Renders nothing. */}
          <LocaleSync />
          <PostHogIdentity />
          <ThemeProvider>{children}</ThemeProvider>
        </TenantProvider>
      </CountryProvider>
      </ConvexQueryCacheProvider>
    </ConvexAuthNextjsProvider>
  );
}
