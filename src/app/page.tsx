"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Dashboard } from "./_components/Dashboard";
import { SignIn } from "./_components/SignIn";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AuthLoading>
        <div className="grid min-h-screen place-items-center text-soft">Checking session…</div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <Dashboard />
      </Authenticated>
    </main>
  );
}
