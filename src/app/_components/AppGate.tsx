"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { usePathname } from "next/navigation";
import { SignIn } from "./SignIn";
import { CourseSkeleton, DashboardSkeleton } from "./ui";

// The auth gate for every route in the (app) group (ADR 0012). Lifted out of the
// old single page so a deep link like /courses/x/lessons/y renders <SignIn> *at
// that URL* while signed out, then re-renders into the content after sign-in —
// no redirect, so the learner lands exactly where the link pointed.
export function AppGate({ children }: { children: React.ReactNode }) {
  // Match the skeleton to the destination the deep link points at: a /courses/*
  // URL resolves into the course view, everything else into the dashboard.
  const pathname = usePathname();
  const onCourse = pathname?.startsWith("/courses/") ?? false;
  return (
    <main className="min-h-screen bg-paper text-ink">
      <AuthLoading>{onCourse ? <CourseSkeleton /> : <DashboardSkeleton />}</AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </main>
  );
}
