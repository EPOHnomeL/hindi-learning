// Narrate a course with Kokoro, a speech model that runs on the operator's own
// machine. Nothing here calls a paid provider: the audio is rendered locally and
// the finished mp3s are uploaded.
//
//   pnpm narrate:prod --topic prophetic-school          # 1. pull the words
//   (render them, see "The render" below)               # 2. make the audio
//   pnpm narrate:prod --topic prophetic-school --push   # 3. upload it
//
// Step 1 writes one text file per lesson under `.narration/<slug>/text/`, already
// run through `narrationFromHtml` and `speakable`, so what is spoken is the lesson's
// prose (no quiz cards, no markup) spelled the way it is said. It also prints which
// recordings are still missing, and deletes a local mp3 whose words have moved on
// since it was rendered: the lesson was edited, or the rules that spell it out
// changed. It refuses to run against a different deployment than the folder was
// pulled from.
//
// Step 3 uploads every mp3 it finds at
// `.narration/<slug>/audio/<voice>/<same name as the text file>.mp3` that the
// deployment does not already hold. It is resumable: render ten lessons, push,
// render ten more, push again. `--force` sends them all regardless.
//
// The render. Any Kokoro front end that turns a folder of .txt into a folder of
// same-named .mp3 will do. The one this was built against:
//
//   <read-aloud>\.venv-kokoro\Scripts\python.exe <read-aloud>\read_aloud_kokoro.py ^
//     .narration\prophetic-school\text ^
//     --out .narration\prophetic-school\audio\am_michael --voice am_michael
//
// once per voice in `NARRATION_VOICES` (convex/narrationVoices.ts). About one
// minute of laptop time per minute of audio, and it skips files that exist.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { narrationFromHtml, speakable } from "../convex/narrationText";
import { NARRATION_VOICES } from "../convex/narrationVoices";
import { convexUrl, publishSecret, topicArg } from "./_env";

const PROD = process.argv.includes("--prod");
const PUSH = process.argv.includes("--push");
// Upload even what the deployment says it already holds. For a recording that
// was rendered again by hand (it sounded wrong) with nothing else changed.
const FORCE = process.argv.includes("--force");
const slug = topicArg();
const deployment = convexUrl(PROD);
const client = new ConvexHttpClient(deployment);
const secret = publishSecret();
const where = PROD ? "PROD (live site)" : "dev";

const root = join(".narration", slug);
const textDir = join(root, "text");
const manifestPath = join(root, "manifest.json");

// What a local mp3 was rendered FROM. `sourceStorageId` is the lesson body blob
// at pull time; the server refuses an upload whose lesson has moved on since.
// `textHash` is the script as written to disk: the words depend on the body AND
// on `narrationFromHtml` / `speakable`, and those rules change without the body
// changing.
type Entry = {
  key: string;
  seq: number;
  title: string;
  file: string;
  sourceStorageId: string;
  chars: number;
  textHash?: string;
};
// `deployment` is which Convex deployment the storage ids belong to. The folder
// is per course, not per deployment, and dev and prod hold the same lesson keys
// under different ids: without this, one pull against the other deployment
// reads every lesson as "edited" and deletes every rendered mp3.
type Manifest = { deployment?: string; lessons: Entry[] };

const fileOf = (seq: number, key: string) => `${String(seq).padStart(3, "0")}-${key.replace(/[^\w-]+/g, "_")}`;
const audioPath = (voice: string, file: string) => join(root, "audio", voice, `${file}.mp3`);
const hashOf = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

function readManifest(): Manifest {
  if (!existsSync(manifestPath)) return { lessons: [] };
  const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest | Entry[];
  // Until 2026-11-24 the manifest was the bare list, with no deployment.
  return Array.isArray(raw) ? { lessons: raw } : raw;
}

// Refuse to mix deployments in one folder, in either direction.
function sameDeployment(manifest: Manifest) {
  if (!manifest.deployment || manifest.deployment === deployment) return;
  console.error(
    `${root} holds a course pulled from another deployment (${new URL(manifest.deployment).hostname}),\n` +
      `and this run targets ${where} (${new URL(deployment).hostname}). Its recordings would be treated as stale\n` +
      `and deleted. Run the command for the deployment it was pulled from, or move ${root} aside first.`,
  );
  process.exit(1);
}

async function pull() {
  const previous = readManifest();
  sameDeployment(previous);
  const ownerEmail = await client.query(api.translate.topicOwnerEmail, { secret, topicSlug: slug });
  if (!ownerEmail) {
    console.error(`No Topic "${slug}" (or it has no owner) on ${where}.`);
    process.exit(1);
  }
  const source = await client.query(api.routine.materialiseTopic, { secret, ownerEmail, topicSlug: slug });
  if (!source) {
    console.error(`Could not materialise "${slug}".`);
    process.exit(1);
  }

  const before = new Map(previous.lessons.map((e) => [e.key, e]));
  mkdirSync(textDir, { recursive: true });
  const entries: Entry[] = [];
  let edited = 0;
  let reworded = 0;
  for (const l of [...source.lessons].sort((a, b) => a.seq - b.seq)) {
    if (!l.htmlUrl || !l.htmlStorageId) {
      console.log(`  ${String(l.seq).padStart(3)}  no body, skipped        ${l.key}`);
      continue;
    }
    const res = await fetch(l.htmlUrl);
    if (!res.ok) throw new Error(`fetching ${l.key} failed: ${res.status} ${res.statusText}`);
    const text = speakable(narrationFromHtml(await res.text()));
    if (!text) {
      console.log(`  ${String(l.seq).padStart(3)}  no prose, skipped       ${l.key}`);
      continue;
    }
    const file = fileOf(l.seq, l.key);
    const textHash = hashOf(text);
    // A recording reads the words it was rendered from. When those have moved
    // on, the local mp3s go, and the next render run makes them again. Two ways
    // that happens: the lesson was edited (a new body), or the rules that turn
    // a body into a script changed (same body, different words). A manifest
    // entry from before hashes existed says nothing about the second, so it is
    // left alone rather than guessed at.
    const was = before.get(l.key);
    const bodyMoved = !!was && was.sourceStorageId !== l.htmlStorageId;
    const wordsMoved = !!was && !bodyMoved && was.textHash !== undefined && was.textHash !== textHash;
    if (was && (bodyMoved || wordsMoved)) {
      for (const voice of NARRATION_VOICES) rmSync(audioPath(voice, was.file), { force: true });
      if (bodyMoved) edited += 1;
      else reworded += 1;
    }
    // One paragraph per blank-line-separated block, which is the shape a TTS
    // front end splits on; `narrationFromHtml` returns one paragraph per line.
    writeFileSync(join(textDir, `${file}.txt`), `${text.split("\n").join("\n\n")}\n`, "utf8");
    entries.push({ key: l.key, seq: l.seq, title: l.title, file, sourceStorageId: l.htmlStorageId, chars: text.length, textHash });
  }
  // A lesson that has left the course takes its text file and its recordings
  // with it, so the render step never narrates a lesson nobody can open.
  const keep = new Set(entries.map((e) => e.file));
  for (const f of readdirSync(textDir)) if (!keep.has(f.replace(/\.txt$/, ""))) rmSync(join(textDir, f));
  for (const e of previous.lessons) {
    if (!keep.has(e.file)) for (const voice of NARRATION_VOICES) rmSync(audioPath(voice, e.file), { force: true });
  }
  const manifest: Manifest = { deployment, lessons: entries };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const chars = entries.reduce((n, e) => n + e.chars, 0);
  console.log(`\n${slug} on ${where}: ${entries.length} lessons, ${chars} characters, in ${textDir}`);
  if (edited) console.log(`${edited} lesson(s) were edited since the last pull; their old recordings were deleted.`);
  if (reworded) console.log(`${reworded} lesson(s) read differently under the current rules; their old recordings were deleted.`);
  for (const voice of NARRATION_VOICES) {
    const have = entries.filter((e) => existsSync(audioPath(voice, e.file))).length;
    console.log(`  ${voice}: ${have} of ${entries.length} rendered locally`);
  }
}

// One recording, from disk to a `lessonAudio` row. Throws on anything that is
// not a clean yes or a stated refusal.
async function send(voice: string, e: Entry): Promise<{ ok: boolean; reason?: string }> {
  const uploadUrl = await client.mutation(api.content.publish.generateContentUploadUrl, { secret });
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": "audio/mpeg" },
    body: readFileSync(audioPath(voice, e.file)),
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${res.statusText}`);
  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
  const args = {
    secret,
    topicSlug: slug,
    lessonKey: e.key,
    voiceId: voice,
    sourceStorageId: e.sourceStorageId as Id<"_storage">,
    storageId,
    chars: e.chars,
  };
  // The file is in storage now and only this call gives it a row. Giving up on
  // the first dropped connection would leave it there, billed and unreachable,
  // so try again: `saveUpload` is safe to repeat with the same `storageId`.
  // ponytail: three tries, then the blob is an orphan and the run says so.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await client.mutation(api.lessonAudio.saveUpload, args);
    } catch (err) {
      if (attempt === 3) throw new Error(`saved to storage as ${storageId} but never recorded: ${String(err)}`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}

async function push() {
  const manifest = readManifest();
  sameDeployment(manifest);
  const entries = manifest.lessons;
  if (!entries.length) {
    console.error(`Nothing pulled for "${slug}" yet. Run without --push first.`);
    process.exit(1);
  }
  const held = await client.query(api.lessonAudio.uploaded, { secret, topicSlug: slug });
  // `chars` is in the key beside the body: a script reworded by a rule change
  // keeps its body id, and its length is the one trace of that the server has.
  // (A rewording of exactly the same length slips past; `--force` is for that.)
  const has = new Set(held.map((r) => `${r.lessonKey}|${r.voiceId}|${r.sourceStorageId}|${r.chars}`));
  let sent = 0;
  let already = 0;
  let missing = 0;
  let refused = 0;
  let failed = 0;
  // Lesson by lesson, every voice of one before the next, so a run cut short
  // leaves whole lessons online rather than one voice of all of them.
  for (const e of entries) {
    for (const voice of NARRATION_VOICES) {
      if (!existsSync(audioPath(voice, e.file))) {
        missing += 1;
        continue;
      }
      if (!FORCE && has.has(`${e.key}|${voice}|${e.sourceStorageId}|${e.chars}`)) {
        already += 1;
        continue;
      }
      // One bad file must not stop the other hundred, or hide the tally.
      try {
        const saved = await send(voice, e);
        // A refusal is returned, not thrown (the server has already deleted
        // the upload; see `saveUpload`).
        if (!saved.ok) {
          refused += 1;
          console.log(`  REFUSED  ${voice} ${e.file}: ${saved.reason}`);
          continue;
        }
        sent += 1;
        console.log(`  uploaded ${voice} ${e.file}`);
      } catch (err) {
        failed += 1;
        console.log(`  FAILED   ${voice} ${e.file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  console.log(
    `\n${slug} on ${where}: ${sent} uploaded, ${already} already there, ${missing} not rendered yet, ` +
      `${refused} refused, ${failed} failed.`,
  );
  if (refused || failed) process.exitCode = 1;
}

await (PUSH ? push() : pull());
