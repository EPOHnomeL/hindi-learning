# 01 — Access & learner-insights dashboard

Status: open (deferred tracker) — no revoke mutation, owner-side 'who has access' query, or dashboard route

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Share**, **Viewer**, **Edition**, **Progress**, **Question**).
Related specs: [`../../topic-sharing/PRD.md`](../../topic-sharing/PRD.md), [`../../course-translation/`](../../course-translation/), [`../../ui-redesign/`](../../ui-redesign/).

## Context / why

The redesigned **Editions & sharing** popup (see [`../../ui-redesign/`](../../ui-redesign/))
deliberately keeps only the two lightweight sharing actions — invite-by-email and
the public-link on/off toggle. It **drops the inline "who has access" list**.

Seeing *and managing* the people an owner has shared a course with — and how each
of them is doing — is a bigger surface than a popup should carry, and it needs
backend that doesn't exist yet (see Backend gaps). This issue scopes that as its
own **owner-facing dashboard**, filed so the popup can ship lean now.

## Want

A per-course, per-Edition **owner dashboard** of everyone the course is shared
with and each Viewer's engagement, plus access management.

Per Viewer:
- **Identity** — email / name, which Edition(s) they hold, when access was
  granted, and whether the invite is still **Pending** (shared to an email with
  no account yet).
- **Progress** — lessons completed / total, %, and last-active.
- **Questions** — the questions this Viewer has asked with the owner's replies,
  and a count of unanswered ones (reply can reuse `capture.replyToQuestion`).
- **Manage** — **revoke** access (and optionally re-send / cancel a pending invite).

Plus a public-link overview: for each Edition, whether the public link is on
(and, later, anonymous/guest usage counts).

## Acceptance (to refine at triage)

- New **owner-scoped** read queries — siblings to the caller-scoped ones in
  [`convex/capture.ts`](../../../convex/capture.ts) — all owner-gated:
  - list the Shares on a Topic/Edition from the **owner's** side (today only
    [`shares.listSharedTopics`](../../../convex/shares.ts) exists, from the
    Viewer's side);
  - a given Viewer's **Progress** and **Questions** for a Topic.
- A **revoke** mutation that deletes a Share (does not exist today).
- A surface/route for the dashboard (e.g. `/courses/[slug]/people`, or a tab in
  the reader), reachable from the Editions popup ("Manage who has access →") and
  the card ⋯ menu.
- **Edition-aware**: a Viewer only holds the Edition(s) shared with them, so the
  view groups or filters by Edition.
- Read-only Viewers never see this (owner-only, mirrors the PRD story-9 posture).

## Depends on

- `topic-sharing` — the Shares relation, `shareTopic`, `listSharedTopics`.
- `course-translation` — per-Edition sharing, `setEditionPublic`.
- `ui-redesign` — the popup this was factored out of.

## Backend gaps (net-new, why this is a feature not a tweak)

- No owner-side "who can view this Topic" query — only the Viewer-side
  `listSharedTopics`.
- No **revoke** mutation on `shares`.
- `capture.myProgress` / `capture.myQuestions` are **caller-scoped**; showing a
  Viewer's data to the owner needs owner-gated variants keyed by the Viewer.

## Notes / open questions (triage)

- **Privacy**: surfacing a Viewer's Questions & Progress to the course owner is
  expected (owner is the teacher), but confirm and record it in `CONTEXT.md` if
  we proceed.
- **Scale**: likely small N of Viewers per course — a plain list is fine for v1;
  no virtualization.
- **Scope guard**: keep invite-by-email + public toggle in the Editions popup;
  this dashboard is the "manage & insight" layer, not the sharing entry point.
- The **Viewer's own** experience (what a shared recipient sees) already ships
  via `topic-sharing`; this issue is only the owner-facing complement.

## Comments
