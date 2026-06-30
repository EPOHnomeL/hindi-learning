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
  return <PublicCourseShell token={token}>{children}</PublicCourseShell>;
}
