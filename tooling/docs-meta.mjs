#!/usr/bin/env node
// Vendored from upstream@9aa1d25e0c9180cefff7e4f1e2c7302a9f874bf0. Do NOT hand-edit; run scripts/refresh-spa.mjs.
// Walk the docs/ tree (plus per-package CONTEXT.md files), build a graph
// of inbound markdown links, capture each file's last commit date via
// git, parse the cluster→ADR table out of CONTEXT-MAP.md, and write the
// whole thing to docs/architecture/_meta.json.
//
// The architecture SPA fetches this file at boot to render backlinks,
// "last updated" timestamps, and per-context ADR chips. If the file is
// missing or stale the SPA still works — those signals just go absent.
//
// Run via the documentation script in package.json before serving.
import { execSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const outFile = join(root, "docs", "architecture", "_meta.json");

const docsRoots = [
  join(root, "docs"),
  join(root, "CONTEXT.md"),
  join(root, "CONTEXT-MAP.md"),
  join(root, "CLAUDE.md"),
];

// Per-package CONTEXT.md files — discovered dynamically so adding a
// package later doesn't require updating this script.
const packagesDir = join(root, "packages");
if (existsSync(packagesDir)) {
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const cm = join(packagesDir, entry.name, "CONTEXT.md");
    if (existsSync(cm)) docsRoots.push(cm);
  }
}
const appsDir = join(root, "apps");
if (existsSync(appsDir)) {
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const cm = join(appsDir, entry.name, "CONTEXT.md");
    if (existsSync(cm)) docsRoots.push(cm);
  }
}
const opsCtx = join(root, "ops", "CONTEXT.md");
if (existsSync(opsCtx)) docsRoots.push(opsCtx);

const allFiles = new Set();
function collect(p) {
  if (!existsSync(p)) return;
  const s = statSync(p);
  if (s.isDirectory()) {
    for (const child of readdirSync(p)) collect(join(p, child));
  } else if (p.toLowerCase().endsWith(".md")) {
    allFiles.add(resolve(p));
  }
}
for (const r of docsRoots) collect(r);

function repoRelative(p) {
  return "/" + posix.normalize(relative(root, p).split("\\").join("/"));
}

// Parse markdown link destinations out of each file.
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

function extractLinks(absPath, body) {
  const out = new Set();
  let m;
  while ((m = LINK_RE.exec(body))) {
    let target = m[1].split(/\s+/)[0]; // drop "title" portion
    if (!target) continue;
    if (target.startsWith("http://") || target.startsWith("https://")) continue;
    if (target.startsWith("mailto:") || target.startsWith("#")) continue;
    target = target.split("#")[0].split("?")[0];
    if (!target) continue;
    if (!target.endsWith(".md")) continue;
    let absTarget;
    if (target.startsWith("/")) {
      absTarget = resolve(root, target.replace(/^\/+/, ""));
    } else {
      absTarget = resolve(dirname(absPath), target);
    }
    out.add(resolve(absTarget));
  }
  return [...out];
}

const backlinks = new Map(); // target → Set<source>
const forwardLinks = new Map(); // source → Set<target>

for (const abs of allFiles) {
  let body;
  try {
    body = readFileSync(abs, "utf8");
  } catch {
    continue;
  }
  const links = extractLinks(abs, body);
  forwardLinks.set(abs, new Set(links));
  for (const target of links) {
    if (!allFiles.has(target)) continue; // only track known files
    if (!backlinks.has(target)) backlinks.set(target, new Set());
    backlinks.get(target).add(abs);
  }
}

// Extract the page title (first H1) so we can render a nice label.
function firstH1(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].replace(/[`*_]/g, "").trim() : "";
}

const fileMeta = {};
for (const abs of allFiles) {
  let body = "";
  try {
    body = readFileSync(abs, "utf8");
  } catch {}
  const rel = repoRelative(abs);
  let updated = null;
  try {
    const iso = execSync(
      `git log -1 --format=%cI -- "${rel.replace(/^\//, "")}"`,
      {
        cwd: root,
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .toString()
      .trim();
    if (iso) updated = iso;
  } catch {}
  if (!updated) {
    try {
      updated = statSync(abs).mtime.toISOString();
    } catch {}
  }
  const incoming = [...(backlinks.get(abs) || [])].map((src) => {
    let body2 = "";
    try {
      body2 = readFileSync(src, "utf8");
    } catch {}
    return {
      path: repoRelative(src),
      title: firstH1(body2) || repoRelative(src),
    };
  });
  fileMeta[rel] = {
    title: firstH1(body) || rel,
    updated,
    backlinks: incoming,
  };
}

// Parse the cluster → ADRs table from CONTEXT-MAP.md.
// The map file currently encodes clusters in a section called
// "Cluster map" with rows of the form:
//   `<cluster name>` — ADRs <NNNN>, <NNNN>; ...
// We accept either pipe-table format or the dash-prose format.
const clusterToAdrs = {};
const ctxMapPath = join(root, "CONTEXT-MAP.md");
if (existsSync(ctxMapPath)) {
  const text = readFileSync(ctxMapPath, "utf8");
  const lines = text.split("\n");
  let inCluster = false;
  for (const line of lines) {
    if (/cluster map/i.test(line) && /^#+/.test(line)) {
      inCluster = true;
      continue;
    }
    if (inCluster && /^#+\s+/.test(line) && !/cluster map/i.test(line))
      inCluster = false;
    if (!inCluster) continue;
    // Lines look like:
    //   - **Cluster name** — ... **ADRs:** [0002 — ...](...), [0005 — ...](...), ...
    const nameMatch = line.match(/^\s*-\s+\*\*([^*]+)\*\*/);
    if (!nameMatch) continue;
    const cluster = nameMatch[1].trim().toLowerCase();
    const adrSectionIdx = line.search(/\*\*\s*ADRs?\s*:?\s*\*\*/i);
    if (adrSectionIdx < 0) continue;
    const tail = line.slice(adrSectionIdx);
    const nums = [...tail.matchAll(/\b(\d{4})\b/g)].map((m) => m[1]);
    if (!nums.length) continue;
    if (!clusterToAdrs[cluster]) clusterToAdrs[cluster] = [];
    clusterToAdrs[cluster].push(...nums);
  }
}

// Map cluster names → context page slugs. Best-effort by name match.
const contextToAdrs = {};
// Cluster names in CONTEXT-MAP don't always match the architecture-doc
// context slugs 1:1; this map encodes the known synonyms so an ADR
// listed under "REC Issuance & IREC integration" still shows up on the
// /issuance context page.
// Single-context repo: there is no CONTEXT-MAP.md cluster map, so this synonym
// table is empty. ADR chips on context pages come from each page's `adrs:`
// frontmatter instead (see docs/architecture/contexts/*.md).
const contextSlugByName = {};
for (const [cluster, adrs] of Object.entries(clusterToAdrs)) {
  const slug = contextSlugByName[cluster];
  if (!slug) continue;
  contextToAdrs[slug] = [...new Set(adrs)];
}

const meta = {
  generatedAt: new Date().toISOString(),
  files: fileMeta,
  contextToAdrs,
};

writeFileSync(outFile, JSON.stringify(meta, null, 2));
process.stdout.write(
  `docs-meta: wrote ${Object.keys(fileMeta).length} files, ${Object.keys(contextToAdrs).length} contexts → ${repoRelative(outFile)}\n`,
);
