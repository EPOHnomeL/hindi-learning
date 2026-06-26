// One-shot cut-over of the existing Hindi Topic onto the multi-tenant model
// (issue 09). Idempotent: ensures the Topic is owned + active with the current
// Mission and moves Handbook.pdf into Convex file storage as a raw Resource.
// (Capture rows were backfilled by the issue-03 migration, now narrowed away.)
//   Usage: pnpm run migrate-hindi          (dev)
//          pnpm run migrate-hindi --prod   (live — take a Convex snapshot first!)
// NOTE: removing the 35 MB Handbook.pdf from git is a SEPARATE, deliberate step
// to run only after verifying the blob is readable from Convex.
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { convexUrl, ownerEmail, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const owner = ownerEmail();
const client = new ConvexHttpClient(convexUrl(PROD));
const SLUG = "hindi";
console.log(`Migrating "${SLUG}" on ${PROD ? "PROD" : "dev"} for ${owner}…`);

// 1. Ensure the Topic exists and is owned.
await client.mutation(api.content.ensureTopic, { secret, ownerEmail: owner, slug: SLUG, title: "Hindi" });

// 2. Publish the existing Mission and activate the Topic.
const mission = readFileSync("MISSION.md", "utf8").trim();
await client.mutation(api.content.publishMission, { secret, ownerEmail: owner, topicSlug: SLUG, mission });
console.log("✓ mission published, status → active");

// 3. Move Handbook.pdf into Convex file storage as a raw Resource (dedupes).
const pdf = readFileSync("Handbook.pdf");
const url = await client.mutation(api.resources.generateProcessedUploadUrl, { secret });
const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: pdf });
if (!res.ok) throw new Error(`Handbook upload failed (${res.status})`);
const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
await client.mutation(api.resources.addResourceAdmin, { secret, ownerEmail: owner, topicSlug: SLUG, filename: "Handbook.pdf", storageId });
console.log("✓ Handbook.pdf stored as a hindi Resource");

console.log('hindi migrated. Verify the Resource reads back, then remove Handbook.pdf from git.');
