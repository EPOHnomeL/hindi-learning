#!/usr/bin/env bash
# Canonical cloud setup for the `teacher-next-lesson` Routine.
#
# The claude.ai cloud environment's *Setup script* field should be EXACTLY:
#     bash scripts/setup.sh
# so setup is version-controlled here and cannot drift from an external text box
# (see docs/routine.md §2). Deterministic + idempotent — safe to re-run.
#
# Why this exists: runs were opening with "Dependencies aren't installed yet"
# and doing a manual install mid-run — pure overhead on every fire. This makes
# deps a guaranteed no-op at run time, and FAILS LOUDLY here (in setup) if they
# did not land, instead of silently deferring the cost into the run.
set -euo pipefail

corepack enable
# --frozen-lockfile: install exactly what the lockfile pins (fail if it is stale)
# so every run gets an identical, reproducible tree — no surprise resolutions.
pnpm install --frozen-lockfile

# pymupdf renders Handbook.pdf pages for grounding (docs/routine.md §2).
python3 -m pip install --quiet pymupdf

# Prove it in SETUP, not mid-run: the Routine's very first command is
# `tsx scripts/claim.ts` talking to Convex, so confirm both actually resolve.
# A non-zero exit here surfaces a broken environment in the setup logs rather
# than as a confusing "let me install first" turn once the run is live.
pnpm exec tsx --version >/dev/null
node --input-type=module -e 'await import("convex/browser")'

echo "setup.sh: ready — deps installed (tsx + convex resolve), pymupdf present."
