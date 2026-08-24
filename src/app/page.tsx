"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Dashboard } from "~/app/_components/Dashboard";
import { DonationHashRedirect } from "~/app/_components/DonationHashRedirect";
import { InstallSheet } from "~/app/_components/InstallSheet";
import { Landing } from "~/app/_components/Landing";
import { useTenantSlug } from "~/app/_components/TenantContext";
import { landingFor } from "~/app/_landing/registry";
import { DashboardSkeleton } from "~/app/_components/ui";

// `/` — the public front door (landing-page/01). Lives OUTSIDE the (app) group
// so it is ungated: signed out it markets the product (the Landing embeds the
// SignIn flow), signed in it is the home dashboard — same URL, no redirect.
export default function HomePage() {
  // Signed out, a tenant may ship a bespoke landing page (issue 16); otherwise
  // fall back to the default <Landing/>, which still re-skins via the SSR palette.
  const slug = useTenantSlug();
  const TenantLanding = landingFor(slug) ?? Landing;
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AuthLoading>
        <DashboardSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <TenantLanding />
      </Unauthenticated>
      <Authenticated>
        {/* A shared `#donations` link has no target here — the Dashboard has no
            donation section — so hand it to /donate, which works in both auth
            states (marketplace/11). Renders nothing when there's no hash. */}
        <DonationHashRedirect />
        <Dashboard />
      </Authenticated>
      {/* The install sheet lives on "/" only, in BOTH auth states, so it mounts
          outside the auth gates (installable-app ticket 03). */}
      <InstallSheet />
    </main>
  );
}
