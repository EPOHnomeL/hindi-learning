export type ArtifactKind = "lesson" | "reference";

/** An artifact as it exists in the local teach workspace (source of truth). */
export interface WorkspaceArtifact {
  kind: ArtifactKind;
  id: string;
  contentHash: string;
  /** For a Lesson only: the id of an existing Lesson this one supersedes. */
  supersedes?: string;
}

/** An artifact already published to the hub. */
export interface PublishedArtifact {
  kind: ArtifactKind;
  id: string;
  contentHash: string;
}

export type PublishAction =
  | { type: "put-blob"; kind: ArtifactKind; id: string }
  | { type: "insert-lesson"; id: string }
  | { type: "upsert-reference"; id: string }
  | { type: "mark-superseded"; id: string; supersededBy: string };

export interface PublishPlan {
  actions: PublishAction[];
}

export function planPublish(
  workspace: WorkspaceArtifact[],
  published: PublishedArtifact[],
): PublishPlan {
  const actions: PublishAction[] = [];
  const publishedLessonIds = new Set(
    published.filter((a) => a.kind === "lesson").map((a) => a.id),
  );
  const publishedReferenceHashes = new Map(
    published.filter((a) => a.kind === "reference").map((a) => [a.id, a.contentHash]),
  );

  for (const artifact of workspace) {
    if (artifact.kind === "lesson") {
      if (publishedLessonIds.has(artifact.id)) {
        continue; // Lessons are immutable — never re-published or updated.
      }
      actions.push({ type: "put-blob", kind: "lesson", id: artifact.id });
      actions.push({ type: "insert-lesson", id: artifact.id });
      if (artifact.supersedes !== undefined) {
        actions.push({
          type: "mark-superseded",
          id: artifact.supersedes,
          supersededBy: artifact.id,
        });
      }
    } else {
      if (publishedReferenceHashes.get(artifact.id) === artifact.contentHash) {
        continue; // Unchanged — current published version already matches.
      }
      actions.push({ type: "put-blob", kind: "reference", id: artifact.id });
      actions.push({ type: "upsert-reference", id: artifact.id });
    }
  }

  return { actions };
}
