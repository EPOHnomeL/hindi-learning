// Operator CLI for learner Resources: inventory a user's Resources by email,
// or hard-delete one (row + raw blob + processed-artifact blobs — storage URLs
// are permanent bearer links, so only a blob delete truly revokes access).
// Usage:
//   pnpm run resource:prod --owner <email>          # list every topic + resource
//   pnpm run resource:prod --remove <resourceId>    # delete one resource
import { ConvexHttpClient } from "convex/browser";
import type { Id } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");

// Read `--name value`, ignoring a missing value or one that's actually the next flag.
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
}

const owner = flag("--owner");
const remove = flag("--remove");
if (!owner && !remove) {
  console.error("Usage: pnpm run resource[:prod] --owner <email> | --remove <resourceId>");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl(PROD));
const secret = publishSecret();

if (remove) {
  const gone = await client.mutation(api.resources.removeResourceAdmin, {
    secret,
    resourceId: remove as Id<"resources">,
  });
  console.log(`removed "${gone.filename}" (${gone.kind}); ${gone.blobsDeleted} storage blob(s) deleted.`);
} else {
  const inventory = await client.query(api.resources.listResourcesAdmin, { secret, ownerEmail: owner! });
  if (inventory.length === 0) console.log("no topics for that owner.");
  for (const topic of inventory) {
    console.log(`${topic.topicSlug} — ${topic.topicTitle}`);
    if (topic.resources.length === 0) console.log("  (no resources)");
    for (const r of topic.resources) console.log(`  ${r.id}  [${r.kind}/${r.status}]  ${r.filename}`);
  }
}
