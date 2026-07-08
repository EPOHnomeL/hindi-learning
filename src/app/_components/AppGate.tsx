"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { SignIn } from "./SignIn";
import { ReaderSkeleton } from "./ui";

// The auth gate for every route in the (app) group (ADR 0012). Lifted out of the
// old single page so a deep link like /courses/x/lessons/y renders <SignIn> *at
// that URL* while signed out, then re-renders into the content after sign-in —
// no redirect, so the learner lands exactly where the link pointed.
export function AppGate({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AuthLoading>
        <div className="p-4 md:h-screen md:p-4">
          <ReaderSkeleton />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </main>
  );
}
