import { CourseShell } from "~/app/_components/CourseShell";

// `/courses/[slug]` and everything under it share this persistent sidebar.
// CourseShell stays mounted across lesson navigation; only the page swaps.
export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CourseShell slug={slug}>{children}</CourseShell>;
}
