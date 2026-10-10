import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { PublicCourseShell } from "~/app/_components/PublicReader";

// `/share/[token]` and everything under it: the ungated Guest reader (issue 07).
// Outside the `(app)` group, so no auth gate. The token is the only credential.
// `referrer: no-referrer` (ADR 0013): the token is in the URL, so a Guest
// clicking an outbound link must not leak it via the `Referer` header. `robots`
// keeps public links out of search indexes.
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function PublicCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // The course bundle, fetched here so the shell paints from the HTML. Field LCP
  // on a shared lesson (2026-10-10) was the mobile header's course title, and most
  // of it was the wait for JS, the Convex socket and this query on the client.
  // The token is the whole argument and needs no auth, so the server asks
  // exactly what the client subscribes to. `share/loading.tsx` covers this wait.
  let initial;
  try {
    initial = await fetchQuery(api.public.publicCourse, { token });
  } catch (err) {
    // Best-effort, like the course layout's canonical-host lookup: on a Convex
    // error the shell falls back to its client-side skeleton.
    console.error("PublicCourseLayout: failed to preload the course bundle", err);
  }
  return (
    <PublicCourseShell src={{ token }} initial={initial}>
      {children}
    </PublicCourseShell>
  );
}
