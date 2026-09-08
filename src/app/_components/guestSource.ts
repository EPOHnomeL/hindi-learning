// Where a Guest reader read is coming from. Two public entrances render the same
// reader (PublicReader.tsx):
//
//   token: the bearer-token share link, `/share/<token>`. Any Edition it was
//          minted for, free or paid.
//   slug:  the course's own pretty URL, `/courses/<slug>`, which serves the
//          Guest reader only when the Edition is published AND priced (see
//          `guestEditionFromSlug` in convex/public.ts). Signed out on anything
//          else, the visitor is asked to create an account instead.
//
// These helpers are the whole difference between the two: the query args, the
// href base, and the per-device storage scope. Pure, so they unit-test without a
// browser or a Convex client.
export type GuestSource =
  | { token: string; slug?: undefined; lang?: undefined }
  | { token?: undefined; slug: string; lang: string | null };

// The Convex args for `api.public.public*`. `lang` is only ever sent on the slug
// entrance; a share token already fixes exactly one Edition.
export function guestArgs(src: GuestSource): { token?: string; slug?: string; lang?: string } {
  return src.token ? { token: src.token } : { slug: src.slug, ...(src.lang ? { lang: src.lang } : {}) };
}

// A reader href under this entrance. `path` is the suffix, e.g. "/lessons/0001".
// On the slug entrance the Edition language rides along as `?lang=`, exactly as
// it does in the authed reader, so navigating does not silently drop back to the
// English Edition.
export function guestHref(src: GuestSource, path = ""): string {
  if (src.token) return `/share/${src.token}${path}`;
  const href = `/courses/${src.slug}${path}`;
  return src.lang ? `${href}?lang=${encodeURIComponent(src.lang)}` : href;
}

// The scope key for a Guest's per-device state (their completed set, the
// first-open welcome latch). One scope per Edition per entrance.
export function guestScope(src: GuestSource): string {
  return src.token ?? `${src.slug}:${src.lang ?? ""}`;
}

// The Guest reader route a signed-out `/courses/...` pathname maps to, or null
// when the path is not a readable course surface. `/courses/<slug>/manage` is
// the owner's console and is deliberately not one of them.
export type GuestRoute =
  | { slug: string; kind: "index" }
  | { slug: string; kind: "lesson" | "reference"; key: string };
export function guestRoute(pathname: string): GuestRoute | null {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== "courses" || !parts[1]) return null;
  const slug = parts[1];
  if (parts.length === 2) return { slug, kind: "index" };
  if (parts.length !== 4 || !parts[3]) return null;
  if (parts[2] === "lessons") return { slug, kind: "lesson", key: parts[3] };
  if (parts[2] === "references") return { slug, kind: "reference", key: parts[3] };
  return null;
}
