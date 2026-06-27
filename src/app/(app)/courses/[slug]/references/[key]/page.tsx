import { ReferencePane } from "~/app/_components/CoursePanes";

// `/courses/[slug]/references/[key]` — one Reference, identified by its `key`.
export default async function ReferencePage({ params }: { params: Promise<{ slug: string; key: string }> }) {
  const { slug, key } = await params;
  return <ReferencePane slug={slug} refKey={key} />;
}
