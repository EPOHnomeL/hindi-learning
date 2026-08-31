# Course translation (Editions) — operational runbook

How the course-translation feature is wired: what performs the translation, the
env it needs, the data it writes, and the access model. This is the **how it's
plumbed**; the **why** (one Topic + many language *renderings*, an **Edition**
as the unit of access, translation gated to *completed* courses) is the
course-translation grilling design. Translation now runs on the **same cloud
Routine machinery** as the next-lesson teacher — so this is a sibling of
[routine.md](routine.md); read that for how a routine is fired, claims work, and
publishes back.

> Translation runs on the cloud **translate Routine**, not an in-app API key.
> The operator step is standing up that routine (its Fire URL/token) and the
> shared `PUBLISH_SECRET` — see §3. Everything else (triggering, progress,
> retries) is in-app.

---

## 1. In one paragraph

When an owner opens the **Editions** panel on a **completed** course and adds a
language, `translate.startTranslation` (an action) seeds a per-`(Topic, language)`
`translationJobs` row `translating` and **fires the translate Routine** (a cloud
Claude Code run, closed fire body — ADR 0008). The fired run claims the pending
Edition (`claimTranslation` → Topic slug + target language + owner), materialises
the source from Convex into `topics/<slug>/`, translates the title, mission, and
each non-superseded Lesson + Reference (following the fidelity rules), publishes
each item back via `publishTranslation`, and finishes with `reportTranslation`.
The reader serves an Edition's content from `translations`, falling back to the
English source per item, and only to callers who **hold** that Edition.

---

## 2. The compute (the translate Routine)

Translation is done by the **translate Routine** — the sibling of the next-lesson
teacher (routine.md), reusing its lock → claim → materialise → publish → report
shape. **No LLM and no Anthropic API key run in the app** ([ADR 0001](adr/0001-asynchronous-hub-mediated-teaching-loop.md)
holds): the cloud run uses its own Claude access. The app only fires the routine
and accepts the `PUBLISH_SECRET`-guarded writeback.

Convex functions in [`convex/translate.ts`](../convex/translate.ts):

| Function | Kind | Role |
| --- | --- | --- |
| `startTranslation` | action (owner, completed-gated) | Acquire the lock, then POST the routine's Fire URL. |
| `tryAcquireTranslation` | internalMutation | The gate + lock: owner + completed + known-language + single-flight; seeds the job `translating` with the item `total`. |
| `removeEdition` | mutation (owner) | Delete an Edition's translations, job, Shares, and Public link. |
| `claimTranslation` | mutation (`PUBLISH_SECRET`) | Legacy/manual seam: grabs one `(Topic, language)` job whose run is DEAD (heartbeat absent/stale) + owner. |
| `publishTranslation` | mutation (`PUBLISH_SECRET`) | Upsert one translated item + tick the job; re-reads the source to stamp its hash and reject a quiz-structure drift. |
| `reportTranslation` | mutation (`PUBLISH_SECRET`) | Finalise the job `ready` (unpublished items → `failed`, English fallback) or `failed`. |
| `editions` | query (owner) | The Editions panel data (per-language status + share/link counts). |

The cloud run's steps (repo `pnpm` scripts, mirroring the teacher routine):

1. `SLUG=$(pnpm -s run claim-translation:prod)` — claim one pending Edition (or
   `none` → end). Persists `TRANSLATE_LANG` + `OWNER_EMAIL` to `.env.local`.
2. `pnpm run materialise:prod --topic "$SLUG"` — pull the source into `topics/$SLUG/`.
3. Follow [`.agents/skills/translate/SKILL.md`](../.agents/skills/translate/SKILL.md);
   write translations into `topics/$SLUG/translations/$TRANSLATE_LANG/`. The run
   **fans out** in **waves** of at most 4 subagents (2–4 files each, each wave
   drained and published before the next is dispatched), each agent working to
   [`FIDELITY.md`](../.agents/skills/translate/FIDELITY.md); a file over ~600 lines
   is split at `<h2>` boundaries and its sections translated across waves. The
   orchestrating run works **sight unseen** — no course content ever enters its own
   context; that is the token budget.
4. `pnpm run publish-translation:prod --topic "$SLUG"` — publish each translated
   item. Run **after every wave**, not only at the end: it is idempotent and
   publishes whatever is in the workspace, so the Editions panel ticks upward
   while the run is still going, and a run killed infra-side loses at most the
   wave in flight.
5. `pnpm run report-translation:prod ready "$SLUG"` — always, even on failure.

---

## 3. Env / config (operator sets these)

**On the Convex deployment:**

| Var | Required | Purpose |
| --- | --- | --- |
| `PUBLISH_SECRET` | **yes** | Guards claim/publish/report — the *same* secret the teacher routine uses. |
| `TRANSLATE_FIRE_URL` | **yes** | The translate Routine's Fire endpoint, POSTed to kick off a run. |
| `TRANSLATE_FIRE_TOKEN` | **yes** | Bearer token for that Fire endpoint. |

```sh
npx convex env set --prod TRANSLATE_FIRE_URL https://…
npx convex env set --prod TRANSLATE_FIRE_TOKEN …
# PUBLISH_SECRET is already set for the teacher routine — reuse it.
```

**The cloud translate Routine** (a claude.ai routine, sibling of
`teacher-next-lesson`): it clones the repo, then runs the steps in §2. Its
Instructions field is kept in the repo at
[translation-routine-prompt.md](translation-routine-prompt.md) — **that file wins**
if the two drift; re-paste it. Its
cloud env needs `PUBLISH_SECRET` and `CONVEX_PROD_URL` (identical to the teacher
routine). Point `TRANSLATE_FIRE_URL` / `TRANSLATE_FIRE_TOKEN` (above) at this
routine's Fire endpoint.

There is **no** `ANTHROPIC_API_KEY` / `TRANSLATION_MODEL` / `TRANSLATION_MAX_TOKENS`
any more — the cloud run owns the model choice.

---

## 4. Translation fidelity (the hard rules)

The rules live in the `translate` skill, in
[`FIDELITY.md`](../.agents/skills/translate/FIDELITY.md) beside its
[`SKILL.md`](../.agents/skills/translate/SKILL.md) — they are a separate file
because every translating subagent reads them and the orchestrating run does not:
Lesson/Reference HTML is translated with strict preservation — every tag,
attribute, class, id, `data-*` (especially `data-correct` / `data-k` /
`data-answer` / `data-alt`), `<script>`/`<style>`, and element order kept
verbatim; only human-readable prose translated; the **object of study** (the
language being taught, code, proper nouns) left unchanged. This matters because
quiz scoring is **positional** — the reader's iframe bridge derives quiz IDs from
DOM order and reads `data-correct`/`data-k`/`data-answer`
([lessonSrcDoc.ts](../src/app/_components/lessonSrcDoc.ts)). As a server-side
safety net, `publishTranslation` re-checks each Lesson's quiz-marker counts and
**skips** a drifted item (it falls back to English) rather than store a broken quiz.

The rules also require translating **quoted passages and the "Sources" citation
footer** — a quote the course cites is learner-read prose, not object-of-study, so
it must be rendered in the target language (keeping only the attribution: author
names, work titles, proper nouns, page/verse refs). Skipping these is the most
common real-world miss — see §7 / §8.

**Nothing ships in the source language.** Bible verses prefer the **verbatim**
wording of a published target-language Bible (BSI/HHBD Devanagari for Hindi) rather
than a back-translation — but where no reliable published rendering can be
recalled, the translator now renders the passage itself, plainly and at
printed-Bible register, instead of leaving it in English. "Couldn't find a
translation" changes *how* the text is produced, never *whether* it is.

Three further guardrails (added after grading real Hindi output — the tells were a
coined word *inside a verse*, a mixed romanized/Devanagari document, and ordinary
words left in English at random): **never coin a word** (a model appending an
English gloss to its own term is confessing the term is invented — use the real
standard term); **one script per Edition, no leaks** (a `hi` Edition is pure
Devanagari, a `-Latn` Edition pure Latin); and **translate ordinary vocabulary
consistently** rather than leaving some source-language words scattered through. All
three now live in both the `translate` skill and the `buildTranslateMessages` prompt.

---

## 5. Data it writes

- **`translations`** — one row per successfully translated item, keyed
  `(topicId, lang, kind, key)`. A **missing** row ⇒ the reader falls back to the
  English source, so a row exists only for a *successful* translation.
- **`translationJobs`** — one per `(topicId, lang)`; live
  `status`/`total`/`done`/`failed` drives the Editions panel **and** is the
  single-flight lock. `claimedAt` is the run's **heartbeat** (stamped at acquire,
  re-stamped per published item); a `translating` job whose heartbeat goes silent
  past `STALE_MS` is presumed dead and re-fireable — the re-fire **resumes**
  (fresh rows are skipped, `done` re-seeded); a **forced** re-fire (engine switch)
  instead **deletes** the rows, so nothing can read as fresh. Seeded `translating`
  by `startTranslation`; `publishTranslation` ticks `done` **once per item**, not
  per call — a re-publish of an already-landed item returns `unchanged` and ticks
  nothing, because the routine re-publishes the whole workspace every wave.
  `reportTranslation` flips it `ready`/`failed` and, on `ready`, recomputes
  `done`/`failed` by **counting the rows that actually landed** rather than
  subtracting `done` from `total` — so a wrong counter can never report a
  half-translated Edition as complete.
- Sharing an Edition also touches `shares.lang` / `pendingShares.lang` and the
  `publicLinks` table (see §6).

---

## 6. Access model (Editions)

An **Edition** = `(Topic, language)` is the unit of access:

- **Owner** — holds English plus every *ready* Edition (sees all).
- **Viewer** — holds only the languages their Shares grant (a Share is now
  language-scoped; a Viewer may hold several on one Topic).
- **Guest** — holds the one Edition their Public link is scoped to (per-Edition
  token in `publicLinks`; the pre-translation single `topics.publicToken` is
  still honoured as the English link, so existing links survive with no
  migration).

The reader honours `?lang=xx` **only if the caller holds that Edition** — it
can't be self-served by editing the URL. Progress and Certificates stay
per-Topic; a Certificate snapshots the title + text direction of the Edition the
learner completed in.

> **Confidentiality note:** a non-English share/link still exposes the English
> *source* for any item that isn't (yet) translated — the per-item fallback. So
> "share only the translated Edition" is not a confidentiality boundary. Tracked
> in `.scratch/course-translation/issues/05-…`.

---

## 7. Known failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `startTranslation` errors `TRANSLATE_FIRE_URL / TRANSLATE_FIRE_TOKEN not set` | env missing on the deployment | `npx convex env set` them (§3). |
| Add-language does nothing / Edition never leaves `translating` and `done` stops ticking | the translate action was killed infra-side (execution ceiling — a big course), so it never reported | wait for the heartbeat to go stale (~10 min of silence), then fire the language again — the run **resumes** from the already-translated items. Runs are chunked (`CHUNK` items per action) precisely so this stays rare. |
| A translated item still shows English | that item's row is missing (never translated, failed, or a quiz-structure skip) | re-translate the Edition (the panel's retry); the reader falls back to English per item until it lands. |
| Editions panel shows `Ready · N failed` | the run didn't publish N items (skipped or errored) | retry; if a Lesson keeps failing, its translated quiz markers drifted — the skill must preserve them. |
| Owner can't translate a course | the course isn't `completed` | mark it complete first — translation is gated on Completion. |
| "unsupported language" | the target isn't in the offered `LANGUAGES` menu | pick a listed language (extend `convex/languages.ts` to grow the menu). |
| A whole class of prose stays in English — block quotes and especially the lesson "Sources / ذرائع" **footer** | the translator translated the narration but **skipped the verbatim quotations it cites**; the job still reports `ready` (there is no leftover-source-language check) | correct the Edition out-of-band (§8). The fidelity rule now covers this (§4), so *new* translations shouldn't regress. |

---

## 8. Correcting an already-translated Edition (out-of-band fix)

The machine translator has one recurring quality gap: it translates the narration
but **leaves verbatim quotations in the source language** — block quotes,
`.book`/`.note`/`.verse` cards, and especially the lesson `<footer>` "Sources /
ذرائع" citation apparatus. `translationJobs` still reports these `ready` /
0-failed — there is **no leftover-source-language check**, so *ready ≠ fully
translated*. The fidelity rule for this is now explicit (§4 / the `translate` skill
and the `buildTranslateMessages` prompt in `convex/translate.ts`), so **new**
translations should not regress; Editions translated before 2026-07-15 need an
out-of-band correction.

> Corrected so far: **prophetic-school** (Growing in the Holy Spirit) **`ur`** —
> lessons 0004, 0008, 0009, 0023, 0029 (2026-07-15). Its other editions
> (`af`, `es`, `fr`, `mg`) and other tenants' translated courses are **not yet
> checked** and are likely affected the same way.

**Detect** — for each `translations` row: strip `<!-- -->` / `<style>` / `<script>`
/ tags, then flag runs of ≥6 consecutive Latin-script words; segment at `<footer>`
(body vs footer). **Not** bugs — leave these: each lesson's fill-in-the-blank quiz
whose answer is a source-language word; author names, titles of cited works, proper
nouns, page/verse references; Bible verses (render from a published target-language
Bible, never a back-translation).

**Read** the Edition's bodies to disk (a row is inline `html` **or** a blob
`htmlStorageId`): either a scoped `runOneoffQuery` via the prod Convex MCP (needs
`--cautiously-allow-production-pii` — see below), or the secret-guarded
`translate.readEditionBodies` (topic+lang scoped; returns inline `html` or a signed
`url` per item — a CLI fetches the URLs byte-perfect).

> **For a handful of items, edit in the app instead (2026-08-31).** The owner,
> or an Editor of that Edition (ADR 0020), can correct a translated Lesson **or
> Reference** straight from the reader: open the item, press Edit, fix the prose
> (and the title, in the same field), save. It writes that Edition's own
> `translations` row through `editTranslatedLesson` / `editTranslatedReference`,
> stamps the same `sourceHash` this CLI route does, and needs no checkout, no
> `OWNER_EMAIL`, and no secret. The route below is for a **bulk** pass, where
> dozens of items are being swept at once.

**Write** in place, stage **only** the corrected lessons at
`topics/<slug>/translations/<lang>/lessons/<key>.html`, then:

```bash
TRANSLATE_LANG=<lang> pnpm run publish-translation:prod --topic <slug>
```

This re-publishes via the `PUBLISH_SECRET`-guarded `publishTranslation`, which
re-stamps the source hash so a later re-translate keeps the correction, and
preserves the quiz markers (edit only footer/citation/body prose, never `.quiz`
markup). It is **owner-scoped**: `OWNER_EMAIL` in `.env.local` must be the **course
owner's** account — a *tenant* account, **not** the operator — or it throws
"topic not found" (e.g. prophetic-school is owned by the YWAM tenant account, not
`jvorster63`).

### Prod Convex MCP read access

The official `convex` plugin marks the **prod** deployment `readOnly` for the agent
MCP, so `runOneoffQuery` / `data` / `logs` reject it. To read prod, add a second MCP
server started with `--cautiously-allow-production-pii` (read-only tools only — it
does **not** grant writes) and restart the session:

```json
{"mcpServers":{"convex-prod":{"command":"npx","args":["convex","mcp","start","--cautiously-allow-production-pii","--project-dir","<repo>"]}}}
```

This is a **standing prod-PII read grant in a git-tracked file — remove the entry
when the correction pass is done.**
