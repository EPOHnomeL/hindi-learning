// The Edition round-trip: pull one Edition to disk, edit it locally with anything you
// like, push the edits back.
//
//   pnpm edition:pull --topic prophetic-school --lang st-ZA --prod
//   ...edit editions/prophetic-school/st-ZA/working/ ...
//   pnpm edition:push --topic prophetic-school --lang st-ZA --prod          # dry run
//   pnpm edition:push --topic prophetic-school --lang st-ZA --prod --go     # writes
//
// Why this exists: the same three steps have now been hand-rolled twice as one-off
// scripts (the st to st-ZA orthography rewrite, and the hi-Latn to hi Devanagari
// conversion), and both times the interesting part was the local transform while the
// download/upload scaffolding around it was re-derived from scratch, guards included.
// This is that scaffolding, generalised. The transform is deliberately NOT part of it:
// a rewrite script, an agent fan-out, or a human in an editor all work the same way,
// because they all just change files in working/.
//
// Two trees are written, both mirroring the layout of scripts/publish-translation.ts:
//
//   editions/<slug>/<lang>/pristine/     exactly what the Hub holds. Never edit.
//   editions/<slug>/<lang>/working/      the same bytes, for you to change.
//   editions/<slug>/<lang>/edition.json  the manifest: rows, owner, deployment.
//
// Diff them with:
//   git diff --no-index editions/<slug>/<lang>/pristine editions/<slug>/<lang>/working
//
// Push sends only what differs (plus any row still sharing a storage blob with the
// Edition it was cloned from, which must always be republished), refuses outright if
// any item trips a gate, and is a dry run unless you pass --go.
//
// Out of scope by design: creating an Edition (scripts/clone-edition.ts), reporting it
// ready (translate.reportTranslation), pricing it, and listing it in the catalogue.
// The last two are owner-only and happen in the Editions panel, not from a script.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret, topicArg } from "./_env";
import { fileFor, planPush, type Item, type Kind, type Manifest } from "./edition-workspace";

const cmd = process.argv[2];
const PROD = process.argv.includes("--prod");
const GO = process.argv.includes("--go");
const ALL = process.argv.includes("--all");
const slug = topicArg();

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
}

const USAGE =
  "Usage:\n" +
  "  pnpm tsx scripts/edition.ts pull --topic <slug> --lang <lang> [--prod] [--force]\n" +
  "  pnpm tsx scripts/edition.ts push --topic <slug> --lang <lang> [--prod] [--go] [--all] [--owner <email>]\n";

if (cmd !== "pull" && cmd !== "push") {
  console.error(USAGE);
  process.exit(1);
}

const lang = flag("--lang");
if (!lang) {
  console.error(`Missing --lang <code>.\n\n${USAGE}`);
  process.exit(1);
}
// English is the SOURCE Edition and has no translations rows at all: its content is
// the Lessons themselves. Editing it goes through scripts/publish.ts, and a
// publishTranslation against "en" would be meaningless rather than merely wrong.
if (lang === "en") {
  console.error('"en" is the source Edition, not a translation. Edit the source with scripts/publish.ts instead.');
  process.exit(1);
}

const ROOT = `editions/${slug}/${lang}`;
const MANIFEST = `${ROOT}/edition.json`;
const client = new ConvexHttpClient(convexUrl(PROD));
const secret = publishSecret();

const write = (path: string, body: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
};

// ---- pull ------------------------------------------------------------------

if (cmd === "pull") {
  if (existsSync(ROOT) && readdirSync(ROOT).length > 0) {
    // Re-pulling overwrites working/, which is exactly how a half-finished conversion
    // disappears. Make the operator say so out loud.
    if (!process.argv.includes("--force")) {
      console.error(
        `${ROOT}/ already exists and is not empty.\n` +
          "Re-pulling OVERWRITES working/ and would discard any local edits.\n" +
          "Push them, or move them aside, or pass --force if you mean to throw them away.",
      );
      process.exit(1);
    }
    console.log(`--force: overwriting the existing workspace at ${ROOT}/`);
  }

  const rows = await client.query(api.translate.readEditionBodies, { secret, topicSlug: slug, lang });
  if (rows === null) throw new Error(`no Topic "${slug}" on ${PROD ? "PROD" : "dev"}`);
  if (rows.length === 0) {
    console.error(
      `Topic "${slug}" exists but has no ${lang} Edition (zero translations rows).\n` +
        `Stand one up first with:\n` +
        `  pnpm tsx scripts/clone-edition.ts --topic ${slug} --from <lang> --to ${lang}${PROD ? " --prod" : ""}`,
    );
    process.exit(1);
  }

  // Not fatal. The owner is only needed by push, and a deployment that predates the
  // `topicOwnerEmail` seam should still give you a workspace rather than a stack trace.
  const ownerEmail = await client
    .query(api.translate.topicOwnerEmail, { secret, topicSlug: slug })
    .catch((e: unknown) => {
      console.log(`! could not resolve the Topic owner: ${(e as Error).message}`);
      console.log("  (if this deployment predates translate.topicOwnerEmail, deploy Convex.)");
      return null;
    });
  if (!ownerEmail) console.log("! No owner email recorded. push will need --owner <email>.");

  const items: Item[] = [];
  let skippedQuestions = 0;
  let blobBacked = 0;
  for (const r of rows) {
    if (r.kind === "question") {
      // Learner Q&A, not course content. Round-tripping a reply is a different job with
      // a different trust boundary, so it is left alone rather than half-supported.
      skippedQuestions++;
      continue;
    }
    const file = fileFor(r.kind as Kind, r.key);
    let body: string;
    if (r.kind === "title" || r.kind === "mission") {
      body = r.text ?? "";
    } else {
      // A blob URL, when present, is the authoritative body: the inline html field is
      // empty for a blob-backed row.
      body = r.url ? await (await fetch(r.url)).text() : (r.html ?? "");
      if (body === "") throw new Error(`row ${r.kind}/${r.key} has neither an inline body nor a readable blob`);
      if (r.url) blobBacked++;
    }
    write(`${ROOT}/pristine/${file}`, body);
    write(`${ROOT}/working/${file}`, body);
    items.push({ kind: r.kind as Kind, key: r.key, title: r.title, file, blobBacked: r.url !== null });
  }

  const manifest: Manifest = {
    topicSlug: slug,
    lang,
    deployment: PROD ? "prod" : "dev",
    ownerEmail,
    pulledAt: new Date().toISOString(),
    items,
  };
  write(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  const byKind = items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});
  console.log(`pulled ${items.length} items from ${PROD ? "PROD" : "dev"} into ${ROOT}/`);
  console.log(`  ${Object.entries(byKind).map(([k, n]) => `${n} ${k}`).join(", ")}`);
  if (blobBacked) console.log(`  ${blobBacked} blob-backed (always republished, even when unchanged)`);
  if (skippedQuestions) console.log(`  ${skippedQuestions} question rows skipped (learner Q&A, not editable here)`);
  console.log(`  owner: ${ownerEmail ?? "UNKNOWN"}`);
  console.log(`\nEdit ${ROOT}/working/, then:`);
  console.log(`  git diff --no-index ${ROOT}/pristine ${ROOT}/working`);
  console.log(`  pnpm tsx scripts/edition.ts push --topic ${slug} --lang ${lang}${PROD ? " --prod" : ""}`);
  process.exit(0);
}

// ---- push ------------------------------------------------------------------

if (!existsSync(MANIFEST)) {
  console.error(
    `No workspace at ${ROOT}/. Pull it first:\n` +
      `  pnpm tsx scripts/edition.ts pull --topic ${slug} --lang ${lang}${PROD ? " --prod" : ""}`,
  );
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
// Pushing a dev-pulled workspace at prod (or the reverse) would write bodies derived
// from a different deployment's content. The manifest remembers where it came from.
if (manifest.deployment !== (PROD ? "prod" : "dev")) {
  console.error(
    `This workspace was pulled from ${manifest.deployment.toUpperCase()} but you are pushing to ${PROD ? "PROD" : "dev"}.\n` +
      `Re-run with ${manifest.deployment === "prod" ? "--prod" : "no --prod"}, or re-pull.`,
  );
  process.exit(1);
}

const owner = flag("--owner") ?? manifest.ownerEmail ?? process.env.OWNER_EMAIL;
if (!owner) {
  console.error(
    "No owner email: none was recorded at pull time and no --owner was given.\n" +
      "It must be the email of the Topic's OWNER, which is not necessarily yours.",
  );
  process.exit(1);
}

const read = (path: string): string | null => {
  const full = `${ROOT}/${path}`;
  return existsSync(full) ? readFileSync(full, "utf8") : null;
};
const plan = planPush(manifest, read, { all: ALL });

console.log(`${manifest.topicSlug} / ${manifest.lang} on ${manifest.deployment.toUpperCase()} as ${owner}`);
for (const { item, body, reason } of plan.send) {
  const size = "html" in body ? `${body.html.length} chars html` : `${body.text.length} chars text`;
  console.log(`  send      ${item.kind.padEnd(9)} ${(item.key || "(course)").padEnd(36)} ${size}  [${reason}]`);
}
console.log(`  ${plan.unchanged.length} unchanged (not sent${ALL ? "" : "; pass --all to send them anyway"})`);

if (plan.problems.length > 0) {
  console.error(`\n${plan.problems.length} item(s) cannot be pushed:`);
  for (const p of plan.problems) {
    console.error(`  ${p.problem.toUpperCase()} ${p.item.kind}/${p.item.key || "(course)"}\n    ${p.detail ?? ""}`);
  }
  // The whole run is refused, not just the bad items: a half-converted Edition reads as
  // two different courses and nothing on disk records where the seam is.
  console.error("\nRefusing to push. Fix these and re-run.");
  process.exit(1);
}

if (plan.send.length === 0) {
  console.log("\nNothing to push.");
  process.exit(0);
}
if (!GO) {
  console.log("\nDRY RUN. Nothing written. Re-run with --go to push.");
  process.exit(0);
}

const tally: Record<string, number> = {};
for (const { item, body } of plan.send) {
  // The ACTION, never the bare publishTranslation mutation: the mutation's quiz guard
  // cannot read a blob-backed source and so is dead code for Lessons. The action reads
  // the source blob and actually enforces it. Both of this framework's ancestors
  // published unchecked rows by calling the mutation directly.
  const res = await client.action(api.translate.publishTranslationChecked, {
    secret,
    ownerEmail: owner,
    topicSlug: manifest.topicSlug,
    lang: manifest.lang,
    kind: item.kind,
    key: item.key,
    ...body,
  });
  tally[res.status] = (tally[res.status] ?? 0) + 1;
  // "skipped" means the server's quiz guard rejected the body, or the source row is
  // gone, and the reader silently falls back to ENGLISH for that item. That is a
  // failure, not noise, so it does not get to scroll past in a padded column.
  if (res.status === "skipped") console.log(`  !! SKIPPED ${item.kind} ${item.key}`);
  else console.log(`  ${res.status.padEnd(9)} ${item.kind} ${item.key || "(course)"}`);
}
console.log(`\npush: ${JSON.stringify(tally)}`);

if (tally.skipped) {
  console.error(
    `${tally.skipped} item(s) were rejected server-side and now read as ENGLISH.\n` +
      "Investigate before anyone opens the Edition.",
  );
  process.exit(1);
}
// Re-pointing pristine/ at what the Hub now holds makes the next round of edits a clean
// diff, instead of replaying this round's changes forever.
for (const { item, body } of plan.send) {
  write(`${ROOT}/pristine/${item.file}`, "html" in body ? body.html : body.text);
}
console.log(`pristine/ re-based on the pushed bodies. Now open the ${manifest.lang} Edition in a browser and spot-check it.`);
