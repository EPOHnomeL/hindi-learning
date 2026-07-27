"use client";

import { useEffect } from "react";

// The cross-host canonical bounce (issue 18 / ADR 0022 §3), done as a client-side
// history *replace* rather than a server `redirect()`.
//
// Why not `redirect()`: when the wrong-host URL is reached by a client navigation,
// Next performs the cross-origin hop with `location.href` (a history *push*), so
// the wrong-host URL stays in the back stack — pressing Back re-enters it, the
// layout bounces forward again, and the user is pinned to the current subdomain.
// `location.replace` swaps the current entry instead, so Back lands on the page
// the user actually came from (the previous subdomain). The redirect is rare (links
// are minted canonical by construction) and this component renders nothing, so the
// wrong tenant's chrome never paints on the way through.
export function CrossHostRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}
