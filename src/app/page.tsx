"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Dashboard } from "~/app/_components/Dashboard";
import { Landing } from "~/app/_components/Landing";
import { DashboardSkeleton } from "~/app/_components/ui";

// `/` — the public front door (landing-page/01). Lives OUTSIDE the (app) group
// so it is ungated: signed out it markets the product (the Landing embeds the
// SignIn flow), signed in it is the home dashboard — same URL, no redirect.
export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AuthLoading>
        <DashboardSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <Landing />
      </Unauthenticated>
      <Authenticated>
        <Dashboard />
      </Authenticated>
    </main>
  );
}
