// Terminates a course from the cloud Routine (ADR 0015): marks the Topic
// `completed` so the authoring gate refuses it and the reader stops offering
// "Generate next lesson". Called by the teach skill when the Mission's outcomes
// are substantially met (see teach/SKILL.md "Terminating a Course"); the twin of
// report.ts. Reversible — the owner can reopen the course from the app.
//
// It also sets the course's default Emblem (ADR 0017): the teach skill picks a
// representative image for the subject, normalises it to a small square raster,
// and passes it here with a fallback glyph. This uploads the bytes to the Hub
// (served same-origin, never hot-linked) and hands `completeCourse` the reference
// + glyph. An owner override is never clobbered (enforced server-side). Both are
// optional; a course completed with neither falls back to a generic glyph.
//   Usage: pnpm run complete:prod <topicSlug> [--image <path>] [--glyph <glyph>]
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { convexUrl, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");

// Read `--name value`, ignoring a missing value or one that's actually the next flag.
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
}

const imagePath = flag("--image");
const glyph = flag("--glyph");

// The topic slug is the first positional — everything that isn't a flag or a
// flag's value.
const consumed = new Set<string>(["--prod"]);
for (const f of ["--image", "--glyph"]) {
  const i = process.argv.indexOf(f);
  if (i >= 0) {
    consumed.add(process.argv[i]!);
    if (process.argv[i + 1]) consumed.add(process.argv[i + 1]!);
  }
}
const [topicSlug] = process.argv.slice(2).filter((a) => !consumed.has(a));

if (!topicSlug) {
  console.error("Usage: pnpm run complete:prod <topicSlug> [--image <path>] [--glyph <glyph>]");
  process.exit(1);
}

// Raster only — SVG is rejected server-side (XSS on the anonymous page, ADR 0017).
// The extension picks the Content-Type the blob is stored and served with.
const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const client = new ConvexHttpClient(convexUrl(PROD));
const secret = publishSecret();

let emblem: { storageId?: Id<"_storage">; contentType?: string; glyph?: string } | undefined;
if (imagePath || glyph) {
  emblem = {};
  if (imagePath) {
    const contentType = IMAGE_TYPES[extname(imagePath).toLowerCase()];
    if (!contentType) {
      console.error(
        `Unsupported emblem image "${imagePath}" — use .png, .jpg, .jpeg, or .webp (raster only; SVG is rejected).`,
      );
      process.exit(1);
    }
    const bytes = readFileSync(imagePath);
    const url = await client.mutation(api.resources.generateProcessedUploadUrl, { secret });
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": contentType }, body: bytes });
    if (!res.ok) throw new Error(`emblem upload failed (${res.status})`);
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    emblem.storageId = storageId;
    emblem.contentType = contentType;
  }
  if (glyph) emblem.glyph = glyph;
}

await client.mutation(api.content.completeCourse, { secret, topicSlug, ...(emblem ? { emblem } : {}) });
console.log(`marked "${topicSlug}" completed${emblem ? " with emblem" : ""}.`);
