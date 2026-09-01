<!-- NOT A TICKET. Deferred 2026-09-01 in the .plan consolidation: this was a ticket on a map
     that no longer exists, and its subject is now a fog patch under "## Not yet specified" on the
     authoring map. Kept verbatim (frontmatter stripped) so re-cutting it as a ticket costs nothing but a
     `git mv` back into tickets/ and a number. Nothing here is a commitment. -->


# Copyright scan: deferred /scan-for-copyright feature

## Question

Deferred feature idea, captured 2026-07-23. Not yet grilled or PRD'd.

Local working copy: `.plan/maps/copyright-scan/SCOPE.md`

## The idea

A `/scan-for-copyright` capability that checks a course's authored lesson +
reference prose against the web sources it was built from, flagging passages
that copy *protected expression* verbatim (as opposed to uncopyrightable
facts / short phrases). Purpose: let an owner sell a course (e.g. the YWAM
Potch "Basic Tswana" course) with confidence that no source's prose was
lifted wholesale.

## Why it matters

For a language/knowledge course the raw material — individual words, short
phrases, numbers, grammar facts — is not copyrightable, so assembling and
re-teaching it is fine. The real, avoidable risk is narrow:

1. **Verbatim prose** copied from a copyrighted source (UNISA coursework,
   setswana.info, Omniglot commentary, etc.).
2. **CC BY-SA contamination** — copying enough Wikipedia/Wikivoyage prose
   that the lesson becomes a derivative work, whose ShareAlike clause would
   force the whole paid course to be licensed CC BY-SA.
3. **Wholesale selection/arrangement** cloned from one source.

Peace Corps material is US-Government public domain (safe even verbatim);
SA government material is not (state copyright), so treat it facts-only.

The scan targets risks 1–3: fetch each cited source, diff for long verbatim
overlaps, report what needs paraphrasing.

## Decisions captured so far (revisit when scoping)

- **Content source:** pull lesson/reference blobs directly via the Convex
  deploy key (sees drafts + unpublished prose, not just public links).
- **Runtime:** build it the same way as the authoring ("teacher") and
  translator runtimes — i.e. an in-app provider/Routine (claude + openrouter),
  not a Claude Code scheduled agent.
- **Output:** store findings as a report in the DB for the owner to view
  (studio UI), not a repo markdown file or email.

## Open questions for the grilling / PRD stage

- Per-course, per-tenant, or all-courses batch? What triggers a scan (on
  publish? on demand? scheduled cron like translation)?
- Which sources does it diff against — the routine's own cited sources list,
  or a re-search per lesson? (WGS / web-grounded search.)
- What counts as a flag: min verbatim run length, similarity threshold,
  license class of the matched source?
- Cost/instrumentation: tokens per scan run, like the translation-cost work.
- Where in the studio UI does the report surface; who can see it (owner only?).
- Schema: new `copyrightScans` table? relation to topics/lessons.

## Not doing now

Deferred at user request. No skill file, no Convex code, no routine written
yet. Next step when picked up: run the `grilling` skill, then a PRD under
`.plan/maps/copyright-scan/`.

## Done when

The open questions (trigger, source set, flag threshold, cost, report surface, schema) are answered and a spec exists — or the feature is ruled out of scope.

<!-- Migrated 2026-07-30 from GitHub issue #48 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `copyright-scan` map (2026-08-01)

<!-- was .plan/maps/authoring/assets/deferred/scan-for-copyright.md; that single-ticket map was consolidated into course-authoring -->

- The risk being managed is **narrow and specific**: verbatim protected expression,
  CC BY-SA contamination turning a paid course into a ShareAlike derivative, and wholesale
  cloned selection/arrangement. Raw language facts are not copyrightable — do not scope this
  as a general plagiarism engine.
- Licence asymmetry worth remembering: Peace Corps material is US-Government public domain
  (safe verbatim); South African government material is *not* (state copyright) — facts only.
- Three decisions were already captured and should be revisited, not re-derived: content
  pulled via the Convex deploy key (sees drafts), built as an in-app provider/Routine like
  the teacher and translator runtimes (not a Claude Code scheduled agent), and findings
  stored as a DB report for the owner.
- Precedent: the one real scan done by hand (Basic Tswana / ywampotch) was resolved and
  closed on GitHub — read it before scoping the automated version.
- Skills: `/grilling`, then a spec; `convex:convex-expert` for the `copyrightScans` shape.
- **Fog:** cost instrumentation for a scan run — sharpens once the trigger model (on publish /
  on demand / cron) is fixed.
- **Out of scope:** a general-purpose plagiarism checker, or anything that renders a legal
  judgement. The scan flags passages for a human to paraphrase.
