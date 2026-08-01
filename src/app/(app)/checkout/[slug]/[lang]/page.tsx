import { CheckoutPage } from "~/app/_components/CheckoutPage";

// `/checkout/[slug]/[lang]` — the purchase, on its own page (ywampotch-launch/12).
// A SIBLING of `courses/`, deliberately: nesting it under the course would
// inherit `CourseShell`'s sidebar and reader chrome, and a bare mobile-first
// page is the point. Inside `(app)`, so a signed-out visitor from a share link
// gets `SignIn` at this URL — the account step, with no routing of our own.
//
// `lang` is a path segment, not `?lang=`: a required segment cannot be forgotten
// by a future caller, and an implicit language is the prod checkout bug.
export default async function Page({ params }: { params: Promise<{ slug: string; lang: string }> }) {
  const { slug, lang } = await params;
  return <CheckoutPage topicSlug={slug} lang={lang} />;
}
