# Copyright scan

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision on whether `/scan-for-copyright` gets built, and if so a spec: what triggers a
scan, which sources it diffs against, what counts as a flag, and where the report surfaces —
so an owner can sell a course knowing no source's prose was lifted wholesale.

## Notes

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

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Cost instrumentation for a scan run.** Named in ticket 01 as an open question; sharpens
  once the trigger model (on publish / on demand / cron) is fixed.

## Out of scope

- A general-purpose plagiarism checker, or anything that renders a legal judgement. The scan
  flags passages for a human to paraphrase.
