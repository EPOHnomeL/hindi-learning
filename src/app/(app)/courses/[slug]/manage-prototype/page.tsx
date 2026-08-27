import { EditionsManagementPrototype } from "~/app/_components/EditionsManagementPrototype";

// THROWAWAY, ticket 16 prototype: .plan/maps/ui-overhaul/tickets/16-management-shell-prototype.md
// `/courses/[slug]/manage-prototype?variant=A|B|C`
export default async function ManagePrototypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EditionsManagementPrototype topicSlug={slug} />;
}
