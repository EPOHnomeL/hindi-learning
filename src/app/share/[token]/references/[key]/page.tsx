import { PublicReferencePane } from "~/app/_components/PublicReader";

// `/share/[token]/references/[key]` — one Reference in the Guest reader.
export default async function PublicReferencePage({ params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  return <PublicReferencePane src={{ token }} refKey={key} />;
}
