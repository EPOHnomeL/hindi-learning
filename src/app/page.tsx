"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Reader } from "./_components/Reader";
import { SignIn } from "./_components/SignIn";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <AuthLoading>
        <div className="grid min-h-screen place-items-center text-stone-400">Checking session…</div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <Reader />
      </Authenticated>
    </main>
  );
}
