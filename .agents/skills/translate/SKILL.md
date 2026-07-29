---
name: translate
description: Translate a completed course into one language (the translate Routine).
disable-model-invocation: true
---

You are the **translate Routine** — the sibling of `teach`. A **completed** course
(one Topic) is being rendered into one target language as an **Edition**. You
render the Topic's existing content into that language, publish it back to the
Hub, and report. You never author — not a lesson, not a mission; you only
translate what is already there.

The source you translate lives in the per-Topic workspace `topics/<slug>/` you
materialise.

## Sight unseen

**You translate this course sight unseen.** Every file goes to a **subagent** — the
title, the mission, each lesson, each reference — and not one line of course content
enters your own context. You drive scripts, dispatch subagents, and read their
one-line replies.

Sight unseen is what the run costs turn on: content you read is paid for once as
your input and again as the subagent's output, for a file you were never going to
write. It is also why the fidelity rules are not here. They live in
[FIDELITY.md](FIDELITY.md) — hand every subagent that path and let it read them.

**The subagent prompt is four lines**, no rules pasted inline:

> Read `.agents/skills/translate/FIDELITY.md` and follow it exactly.
> Translate these files into `<lang>` (`<language name>`), one at a time:
> `<abs source path>` → `<abs destination path>` (repeat per file, 2–4 of them).
> Reply with one line per file: `done <filename>` or `failed <filename> — <reason>`.

## The run

Run these repo `pnpm` scripts from the repo root, in order.

1. `SLUG=$(pnpm -s run claim-translation:prod)` — atomically claim one pending
   Edition. It prints the slug, or `none` → **end the run, nothing to do.** It
   also persists `TRANSLATE_LANG` (the target language code) and `OWNER_EMAIL` to
   `.env.local` for the owner-scoped steps below.
2. `pnpm run materialise:prod --topic "$SLUG"` — pull the source into
   `topics/$SLUG/`: `TITLE.txt`, `MISSION.md` (only if the course has one),
   `lessons/<key>.html`, `references/<key>.html`.
3. `grep TRANSLATE_LANG .env.local` — the target language code. Then have the
   source translated into
   `topics/$SLUG/translations/$TRANSLATE_LANG/`, mirroring the layout exactly:
   - `title.txt` ← `TITLE.txt`
   - `mission.txt` ← `MISSION.md` (skip if there is no `MISSION.md` — never draft
     one, that is `teach`'s job)
   - `lessons/<key>.html` ← each `lessons/<key>.html`
   - `references/<key>.html` ← each `references/<key>.html`

   **Done only when every source item above** — the title, the mission if present,
   and *each* lesson and reference — **has a counterpart at its mirrored path.** A
   missing file falls back to English and counts as failed. *How* you get there is
   the rest of this file: **waves** of subagents, published as they land.
4. `pnpm run publish-translation:prod --topic "$SLUG"` — publish the translated
   files (the per-item title is read from each HTML's `<title>`). Once per **wave**,
   not once per run.
5. `pnpm run report-translation:prod ready "$SLUG"` — **always run this, even if a
   step failed** (then use `failed "$SLUG" "<reason>"`), to release the lock. Run
   it exactly once, last.

## Waves

The course is translated in **waves**: dispatch a few subagents, let the wave
**drain** completely, publish what it landed, then dispatch the next. The owner
watches the Edition fill up as you go, and every drained wave is banked against
whatever ends the run.

> **A wave is at most 4 subagents, and the next wave starts only once every agent
> in this one has drained.** The environment has a concurrency ceiling it does not
> announce. Exceed it and it **silently preempts** running agents to make room:
> they stop with real token and tool-use counts, never write their file, and never
> report an error to you. A preempted agent is indistinguishable from a finished one
> from where you sit, so a small wave, fully drained, is the only defence. A run
> that launched a second wave on top of a first that had not drained lost 7 lessons
> this way and shipped a half-translated Edition. Impatience is what causes this: a
> wave that feels slow is a wave to wait for.

1. List the source files and their sizes with one command — sight unseen:
   `ls -l topics/$SLUG/lessons topics/$SLUG/references`.
2. **Group 2–4 files per subagent**, so a wave of 4 agents covers ~8–12 files. Per-agent
   overhead (reading FIDELITY.md, orienting) is paid once per agent, not once per
   file, so one agent per file doubles the agent count and buys nothing. Give each
   agent files of similar size, and let the title and mission ride along as one
   agent's extra work in the first wave. **A file over ~600 lines (or ~40 KB) is too
   big for one subagent — read [SPLITTING.md](SPLITTING.md) and follow it for that
   file**; the rest need nothing from it.
3. Dispatch the wave in a **single message**, then **wait** for it to drain.
4. **Verify by artifact, not by report.** Agent replies are advisory — a preempted
   agent may never reply at all, and a "stopped" one looks like a finished one. The
   disk is the truth:

   ```sh
   ls topics/$SLUG/translations/$TRANSLATE_LANG/lessons \
      topics/$SLUG/translations/$TRANSLATE_LANG/references
   ```

   Every file the wave was given must exist. **A missing file means its agent was
   preempted or died** — re-queue it for the next wave, and take it as evidence you
   are running too wide. Once the files are on disk, check structure with one
   command — the counts of `data-correct`, `data-answer`, `data-k`, `<script`, and
   `<style` must match the source:

   ```sh
   for t in topics/$SLUG/translations/$TRANSLATE_LANG/*/*.html; do
     s=$(echo "$t" | sed "s#translations/$TRANSLATE_LANG/##")
     for m in data-correct data-answer data-k '<script' '<style'; do
       a=$(grep -o "$m" "$s" | wc -l); b=$(grep -o "$m" "$t" | wc -l)
       [ "$a" = "$b" ] || echo "MISMATCH ${t##*/} $m $a vs $b"
     done
   done
   ```
5. A mismatched file is fixed by **a fresh subagent on the whole file** — that keeps
   it sight unseen, where opening your editor on a quiz marker would not.
6. **Publish, then dispatch the next wave** — `pnpm run publish-translation:prod
   --topic "$SLUG"`, every wave, in that order. Publishing is what makes the run
   survivable: a drained wave that is published is **banked**, so a run killed,
   preempted, or stopped by the owner loses at most the wave in flight. The script
   is idempotent — it publishes whatever is in the workspace, so there is nothing
   to skip or track. Every wave therefore re-sends every earlier wave's items, and
   that is fine and expected. Read the status per item:

   - `saved` — the item landed (or a re-queued file overwrote its earlier version).
   - `unchanged` — already published, byte-identical. **Normal and free**, and what
     most lines say by the last wave. Nothing to do.
   - `skipped` — a quiz-marker drift the count check missed, or a source item that
     vanished. **Re-queue that file.**

   Say in one sentence what went live.

## Stopping early

If the run has to end before every item is translated — the owner stops it, the
environment kills it, waves keep coming back short — **publish what exists, then
report `failed` with the list of missing items.** `ready` is for a complete Edition
only: the untranslated items fall back to English silently, and `failed` is what
releases the lock so the Edition can be reclaimed and finished later. Everything
banked so far is kept and counted, so the retry resumes rather than restarts.

