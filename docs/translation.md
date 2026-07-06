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
| `claimTranslation` | mutation (`PUBLISH_SECRET`) | The run grabs one locked-but-unclaimed `(Topic, language)` job + owner. |
| `publishTranslation` | mutation (`PUBLISH_SECRET`) | Upsert one translated item + tick the job; re-reads the source to stamp its hash and reject a quiz-structure drift. |
| `reportTranslation` | mutation (`PUBLISH_SECRET`) | Finalise the job `ready` (unpublished items → `failed`, English fallback) or `failed`. |
| `editions` | query (owner) | The Editions panel data (per-language status + share/link counts). |

The cloud run's steps (repo `pnpm` scripts, mirroring the teacher routine):

1. `SLUG=$(pnpm -s run claim-translation:prod)` — claim one pending Edition (or
   `none` → end). Persists `TRANSLATE_LANG` + `OWNER_EMAIL` to `.env.local`.
2. `pnpm run materialise:prod --topic "$SLUG"` — pull the source into `topics/$SLUG/`.
3. Follow [`.agents/skills/translate/SKILL.md`](../.agents/skills/translate/SKILL.md);
   write translations into `topics/$SLUG/translations/$TRANSLATE_LANG/`.
4. `pnpm run publish-translation:prod --topic "$SLUG"` — publish each translated item.
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
`teacher-next-lesson`): it clones the repo, then runs the five steps in §2. Its
cloud env needs `PUBLISH_SECRET` and `CONVEX_PROD_URL` (identical to the teacher
routine). Point `TRANSLATE_FIRE_URL` / `TRANSLATE_FIRE_TOKEN` (above) at this
routine's Fire endpoint.

There is **no** `ANTHROPIC_API_KEY` / `TRANSLATION_MODEL` / `TRANSLATION_MAX_TOKENS`
any more — the cloud run owns the model choice.

---

## 4. Translation fidelity (the hard rules)

The rules live in the `translate` skill
([`.agents/skills/translate/SKILL.md`](../.agents/skills/translate/SKILL.md)):
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

---

## 5. Data it writes

- **`translations`** — one row per successfully translated item, keyed
  `(topicId, lang, kind, key)`. A **missing** row ⇒ the reader falls back to the
  English source, so a row exists only for a *successful* translation.
- **`translationJobs`** — one per `(topicId, lang)`; live
  `status`/`total`/`done`/`failed` drives the Editions panel **and** is the
  single-flight lock (`claimedAt`/`runId`) the routine claims against. Seeded
  `translating` by `startTranslation`; `publishTranslation` ticks `done`;
  `reportTranslation` flips it `ready`/`failed`.
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
| Add-language does nothing / Edition never leaves `translating` | the cloud translate Routine isn't set up, isn't firing, or crashed mid-run | check the routine exists and its logs; a stuck job is cleared by removing the Edition and re-adding it. |
| A translated item still shows English | that item's row is missing (never translated, failed, or a quiz-structure skip) | re-translate the Edition (the panel's retry); the reader falls back to English per item until it lands. |
| Editions panel shows `Ready · N failed` | the run didn't publish N items (skipped or errored) | retry; if a Lesson keeps failing, its translated quiz markers drifted — the skill must preserve them. |
| Owner can't translate a course | the course isn't `completed` | mark it complete first — translation is gated on Completion. |
| "unsupported language" | the target isn't in the offered `LANGUAGES` menu | pick a listed language (extend `convex/languages.ts` to grow the menu). |
