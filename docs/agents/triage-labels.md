# Triage Labels

> **Mostly historical since 2026-07-30.** The labels below lived on GitHub issues,
> and GitHub issues are retired — chartr maps under `.plan/maps/` have no label
> field and never store status (see
> [issue-tracker.md](issue-tracker.md)). Keep this file for two reasons: the
> mattpocock skills still speak in these role names, and the closed GitHub issues
> that remain as history still carry them.
>
> **How the roles are expressed now:** a ticket's *readiness* is derived from the
> map, not labelled — `needs-triage` / `to-scope` is simply an open ticket of
> `type: grilling` (it needs a decision before anything can be built),
> `ready-for-agent` is an unblocked `type: task` with a sharp `## Done when`,
> `needs-info` is a blocker stated in the ticket's own prose, and `wontfix` is a
> `## Ruled out` section plus a line in the map's **Out of scope**.

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

These exist as labels on the GitHub repo (created 2026-07-10) and still sit on the
closed issues kept there as history. **Do not apply them to anything new** — there is
nothing on GitHub left to label.

## `to-scope` is not a triage role

There was a sixth label in the tracker, `to-scope`, carried by most of the
backlog that became this repo's maps. It was **orthogonal** to the five roles
above, not a member of them:

- A **triage role** says how far through triage the issue is. Every issue has
  exactly one.
- **`to-scope`** says the issue is a feature idea that still needs *scoping* —
  a grilling and a PRD — before anything can be built from it. It is the
  standing marker for "this is backlog, not a work item".

So `needs-triage` + `to-scope` together is correct and common: nobody has
evaluated it *and* it would need scoping if they did. Don't apply `to-scope`
in place of a triage role, and don't treat its presence as triage having
happened.
