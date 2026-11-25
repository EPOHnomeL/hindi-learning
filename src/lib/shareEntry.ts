import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { firstLessonKey } from "../app/_components/readerDerive";

// Where a Public link's course index (`/share/<token>` itself) should send the
// Guest: the first lesson, with the query string carried through. Null for any
// other path, and for a dead link, an empty course or a Convex error, where the
// index page renders its own message (or its client redirect) as before.
//
// Done in the middleware as a 307 rather than by `PublicCourseIndex`'s
// `router.replace` alone: the client hop let posthog-js record the index as a
// pageview of its own before the lesson's, so every shared-link visit counted
// two entry pages and doubled the top of every share funnel. A server redirect
// never loads the index in the browser. `page.tsx` cannot do it: `share/
// loading.tsx` has already streamed a 200 by then, so its `redirect()` is a
// client-side one too.
export async function shareEntryRedirect(url: URL): Promise<URL | null> {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "share") return null;
  try {
    const course = await fetchQuery(api.public.publicCourse, { token: decodeURIComponent(parts[1]!) });
    const first = course ? firstLessonKey(course.lessons) : null;
    if (!first) return null;
    const to = new URL(url);
    to.pathname = `/share/${parts[1]}/lessons/${encodeURIComponent(first)}`;
    return to;
  } catch {
    return null;
  }
}
