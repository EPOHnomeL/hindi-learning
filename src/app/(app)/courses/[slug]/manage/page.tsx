import { ManageShell } from "~/app/_components/manage/ManageShell";

// `/courses/[slug]/manage` (ui-overhaul 16): the owner's course-management
// route, replacing the Editions & sharing dialog. Owner-only server-side: every
// query the shell mounts refuses a non-owner; the route itself only needs the
// (app) auth gate.
export default async function ManageCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ManageShell slug={slug} />;
}
