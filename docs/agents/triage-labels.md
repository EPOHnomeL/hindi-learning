# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

These exist as labels on the GitHub repo (created 2026-07-10) — apply them with `gh issue edit <n> --add-label <role>`.

Edit the right-hand column to match whatever vocabulary you actually use.

## `to-scope` is not a triage role

There is a sixth label in the tracker, `to-scope`, carried by most of the open
backlog. It is **orthogonal** to the five roles above, not a member of them:

- A **triage role** says how far through triage the issue is. Every issue has
  exactly one.
- **`to-scope`** says the issue is a feature idea that still needs *scoping* —
  a grilling and a PRD — before anything can be built from it. It is the
  standing marker for "this is backlog, not a work item".

So `needs-triage` + `to-scope` together is correct and common: nobody has
evaluated it *and* it would need scoping if they did. Don't apply `to-scope`
in place of a triage role, and don't treat its presence as triage having
happened.
