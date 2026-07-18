import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { canonicalRedirect, type TenantSlug } from "~/lib/tenant";
import { CourseShell } from "~/app/_components/CourseShell";

// `/courses/[slug]` and everything under it share this persistent sidebar.
// CourseShell stays mounted across lesson navigation; only the page swaps.
//
// This layout is also the single server chokepoint for every course/lesson/
// reference route, so it hosts the cross-host canonical redirect (issue 18 / ADR
// 0022 §3): if the course is opened on a host that isn't its canonical one, bounce
// to the right host (same path + query) before rendering, so it never 404s or
// renders under the wrong tenant's skin. Rarely hit — links are minted canonical
// by construction — and a strict no-op when already canonical, so no redirect loop.
export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const url = (await headers()).get("x-url");
  if (url) {
    let tenant: TenantSlug | null = null;
    try {
      tenant = (await fetchQuery(api.content.topicTenant, { slug })) as TenantSlug | null;
    } catch (err) {
      // Best-effort safety net: a transient Convex error must not block the page.
      // Degrade to no redirect and let the request render on the host it landed on.
      console.error(`CourseLayout: failed to resolve canonical host for "${slug}"`, err);
    }
    const target = canonicalRedirect(url, tenant);
    if (target) redirect(target);
  }

  return <CourseShell slug={slug}>{children}</CourseShell>;
}
