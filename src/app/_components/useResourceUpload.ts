"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// Attach Resources to a Topic — a file (3-step Convex upload) or an external
// link. Shared by the dashboard create form and the reader sidebar.
export function useResourceUpload() {
  const generateUploadUrl = useMutation(api.resources.generateUploadUrl);
  const addResource = useMutation(api.resources.addResource);
  const addUrlResource = useMutation(api.resources.addUrlResource);

  async function uploadFile(topicSlug: string, file: File) {
    const url = await generateUploadUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error(`upload failed (${res.status})`);
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    await addResource({ topicSlug, filename: file.name, storageId });
  }

  async function addLink(topicSlug: string, link: string) {
    await addUrlResource({ topicSlug, url: link });
  }

  return { uploadFile, addLink };
}
