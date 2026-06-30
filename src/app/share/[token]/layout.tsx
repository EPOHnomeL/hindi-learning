import { PublicCourseShell } from "~/app/_components/PublicReader";

// `/share/[token]` and everything under it: the ungated Guest reader (issue 07).
// Outside the `(app)` group, so no auth gate. The token is the only credential.
export const metadata = { robots: { index: false, follow: false } };

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
