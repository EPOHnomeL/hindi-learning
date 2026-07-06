# Course translation (Editions) — operational runbook

How the course-translation feature is wired: what performs the translation, the
env it needs, the data it writes, and the access model. This is the **how it's
plumbed**; the **why** (one Topic + many language *renderings*, an **Edition**
as the unit of access, translation gated to *completed* courses) is the
course-translation grilling design. Sibling of [routine.md](routine.md), which
covers the separate next-lesson Routine.

> The one operator step is provisioning the API key (below). Everything else —
> triggering, progress, retries — is in-app and in-repo.

---

## 1. In one paragraph

When an owner opens the **Editions** panel on a **completed** course and adds a
language, `translate.startTranslation` seeds a per-`(Topic, language)`
`translationJobs` row and fans out one `internal.translate.translateItem`
scheduled action per translatable item — the title, mission, each non-superseded
Lesson and Reference, and the owner's Q&A. Each action calls the **Claude
Messages API** directly (`https://api.anthropic.com/v1/messages`), writes a
`translations` row for that item, and ticks the job; the reader updates
reactively. The reader serves an Edition's content from `translations`, falling
back to the English source per item, and only to callers who **hold** that
Edition. Re-running is idempotent — only items whose source changed (by hash)
are re-translated.

---

## 2. The compute (Convex, in-repo)

There is **no claude.ai Routine and no external agent** for translation — it's a
**Convex action calling the Messages API with `fetch`** (default runtime, no
`"use node"`). This is the small, self-contained instance of the ADR-0014
"programmatic runtime on Claude" direction; [ADR 0001](adr/0001-asynchronous-hub-mediated-teaching-loop.md)
still holds (no LLM runs in the web app — this is backend/action work).

Functions in [`convex/translate.ts`](../convex/translate.ts):

| Function | Kind | Role |
| --- | --- | --- |
| `startTranslation` | mutation (owner, completed-gated) | Seed/refresh the job, fan out one action per stale item. |
| `removeEdition` | mutation (owner) | Delete an Edition's translations, job, Shares, and Public link. |
| `translateItem` | internalAction | Translate one item via Claude, save it, tick the job. |
| `getSourceItem` | internalQuery | Read one item's source content (the action has no DB access). |
| `saveTranslation` | internalMutation | Upsert the `translations` row + advance the job. |
| `editions` | query (owner) | The Editions panel data (per-language status + share/link counts). |

---

## 3. Env / config (operator sets these on the Convex deployment)

Set on the **Convex deployment** (not the repo, not Vercel):

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | **yes** | — | Auth for the Messages API. The operator's key (the Managed-line model) — cost is billed to the operator. |
| `TRANSLATION_MODEL` | no | `claude-opus-4-8` | The model. Set to `claude-sonnet-5` to trade some fidelity for lower cost. |
| `TRANSLATION_MAX_TOKENS` | no | `16000` | Per-item output cap. Raise if a large Lesson trips `translation truncated`. |

```sh
npx convex env set --prod ANTHROPIC_API_KEY sk-ant-...
npx convex env set --prod TRANSLATION_MODEL claude-sonnet-5   # optional
# omit --prod for the dev deployment
```

**The request shape** (kept minimal on purpose): `POST /v1/messages` with headers
`x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`;
body `{ model, max_tokens, system, messages }`. No `temperature`/`top_p` (they
400 on Opus 4.8 / Sonnet 5) and no `thinking` field. A `stop_reason` of
`refusal` or `max_tokens` fails that one item (it falls back to English in the
reader and is counted on the job).

---

## 4. Translation fidelity (the prompt's hard rules)

Lesson/Reference HTML is translated with strict preservation: every tag,
attribute, class, id, `data-*` (especially `data-correct` / `data-k` /
`data-answer` / `data-alt`), `<script>`/`<style>`, and element order are kept
verbatim; only human-readable prose is translated; the **object of study** (the
language being taught, code, proper nouns) is left unchanged. This matters
because quiz scoring is **positional** — the reader's iframe bridge derives quiz
IDs from DOM order and reads `data-correct`/`data-k`/`data-answer`
([lessonSrcDoc.ts](../src/app/_components/lessonSrcDoc.ts)). A post-translation
check fails any Lesson whose quiz-marker counts changed rather than shipping a
broken quiz.

---

## 5. Data it writes

- **`translations`** — one row per successfully translated item, keyed
  `(topicId, lang, kind, key)`. A **missing** row ⇒ the reader falls back to the
  English source, so a row exists only for a *successful* translation.
- **`translationJobs`** — one per `(topicId, lang)`; live
  `status`/`total`/`done`/`failed` drives the Editions panel.
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

---

## 7. Known failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Job errors `ANTHROPIC_API_KEY not set` | env var missing on the deployment | `npx convex env set` it (§3). |
| Item fails `translation truncated` | Lesson HTML exceeded the output cap | raise `TRANSLATION_MAX_TOKENS`; re-translate (only the failed item re-runs). |
| Item fails `quiz structure changed in translation` | the model added/dropped/renamed a quiz marker | re-translate; if persistent, use `TRANSLATION_MODEL=claude-opus-4-8` (higher fidelity). |
| Item fails `translation refused by safety classifier` | a `refusal` stop_reason | rare for course content; re-translate or edit the source. |
| Owner can't translate a course | the course isn't `completed` | mark it complete first — translation is gated on Completion. |
| A translated item still shows English | that item's row is missing (never translated, or failed) | re-translate the Edition; the reader falls back to English per item until it lands. |
