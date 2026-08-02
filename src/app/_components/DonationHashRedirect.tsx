"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Sends a signed-in visitor who followed `<tenant>.my-course.app#donations` on to
// /donate (marketplace/11).
//
// `/` deliberately serves one URL for both auth states and swaps <Landing/> for
// <Dashboard/> — nothing redirects, despite what the bug report assumed. But the
// Dashboard has no donation section and is not gaining one, so for a logged-in
// visitor the hash names something that does not exist on the page they got.
// /donate does exist, in either auth state, so send them there.
//
// The hash is client-only — it is never sent to the server — so this cannot be a
// server redirect. Rendered inside <Authenticated> and returns null: signed out
// the anchor now works on the page itself (see DonateSection's scroll effect),
// so the redirect would be a pointless bounce away from a section that's there.
export function DonationHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === "#donations") router.replace("/donate");
  }, [router]);
  return null;
}
