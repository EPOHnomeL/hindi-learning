"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Dashboard } from "~/app/_components/Dashboard";
import { DonationHashRedirect } from "~/app/_components/DonationHashRedirect";
import { InstallSheet } from "~/app/_components/InstallSheet";
import { Landing } from "~/app/_components/Landing";
import { OfflineHome, useOffline } from "~/app/_components/OfflineHome";
import { DashboardSkeleton } from "~/app/_components/ui";
import { useTenantSlug } from "~/app/_components/TenantContext";
import { useEffect, useRef } from "react";
import { landingFor } from "~/app/_landing/registry";

// `/` — the public front door (landing-page/01). Lives OUTSIDE the (app) group
// so it is ungated: signed out it markets the product (the Landing embeds the
// SignIn flow), signed in it is the home dashboard — same URL, no redirect.
export default function HomePage() {
  // Signed out, a tenant may ship a bespoke landing page (issue 16); otherwise
  // fall back to the default <Landing/>, which still re-skins via the SSR palette.
  const slug = useTenantSlug();
  const TenantLanding = landingFor(slug) ?? Landing;
  // Offline, the auth gate is a trap: Convex Auth resolves UNAUTHENTICATED with
  // no server (walked 2026-08-24), which would hand a signed-in learner the
  // marketing landing with a dead sign-in form. So offline swaps the whole
  // gated tree for the Offline Catalogue (installable-app 05); reconnecting
  // swaps back without a reload.
  const offline = useOffline();

  // Coming back online after an offline spell reloads the document once. Not
  // cosmetic: an offline BOOT makes the Convex Auth client drop its localStorage
  // tokens and resolve signed out (walked 2026-08-24), while the real session
  // survives in the httpOnly cookie; only a document load re-mints the client
  // tokens from it. Without this, reconnecting lands a signed-in learner on the
  // marketing page. The sessionStorage stamp is a loop guard for a flapping
  // connection.
  const wasOffline = useRef(false);
  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    try {
      const last = Number(window.sessionStorage.getItem("hindi:offline-reload") ?? 0);
      if (Date.now() - last < 15000) return;
      window.sessionStorage.setItem("hindi:offline-reload", String(Date.now()));
    } catch {
      /* storage unavailable: reload anyway, the guard is best-effort */
    }
    window.location.reload();
  }, [offline]);

  return (
    <main className="min-h-screen bg-paper text-ink">
      {offline ? (
        <OfflineHome />
      ) : (
        <>
          <AuthLoading>
            <DashboardSkeleton />
          </AuthLoading>
          <Unauthenticated>
            <TenantLanding />
          </Unauthenticated>
          <Authenticated>
            {/* A shared `#donations` link has no target here — the Dashboard has
                no donation section — so hand it to /donate, which works in both
                auth states (marketplace/11). Renders nothing when there's no
                hash. */}
            <DonationHashRedirect />
            <Dashboard />
          </Authenticated>
        </>
      )}
      {/* The install sheet lives on "/" only, in BOTH auth states, so it mounts
          outside the auth gates (installable-app ticket 03). */}
      <InstallSheet />
    </main>
  );
}
