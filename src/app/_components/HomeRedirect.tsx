"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The signed-in half of `/sign-in` and `/sign-up`. Those two routes live in the
// (app) group so `AppGate` hands an unauthenticated visitor `<SignIn/>` at the URL
// itself (ADR 0012), which is the whole point of them; a visitor who is already
// signed in, or who has just signed in on the page, has no business on an account
// form. `/` is the front door in both auth states (it swaps Landing for Dashboard
// rather than redirecting), so it is the one safe destination here.
//
// `replace`, not `push`: a Back tap should leave the site the way it came, not
// bounce off a sign-in page that immediately forwards again.
export function HomeRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/"), [router]);
  return null;
}
