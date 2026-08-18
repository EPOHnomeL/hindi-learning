---
name: to-tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker — one file per ticket in a wayfinder chartr map, edges as text in a local file, or native blocking links on a real tracker.
disable-model-invocation: true
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets** — tracer-bullet vertical slices, each declaring the tickets that **block** it.

The issue tracker and triage label vocabulary should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges** — the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket — green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct — does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown.

### 5. Publish the tickets to the configured tracker

Publish the approved tickets. **How** depends on the tracker `/setup-matt-pocock-skills` configured — the tickets are the same either way, only the shape of the blocking edges changes:

- **A wayfinder map (chartr)** → the tracker is a map directory under `.plan/maps/`, and each ticket is its own file `tickets/NN-slug.md` beside `map.md`. This shape is **not** the `tickets.md` below and **not** the issue template below; use the chartr template and rules that follow. If the repo has a tracker adapter doc (`docs/agents/issue-tracker.md`), read it first — it is the contract and it overrides this skill wherever they differ.
- **Local files** → write one `tickets.md` in the repo root, all tickets in dependency order (blockers first), each with its "Blocked by" listing the titles it depends on. Use the file template below. Only when the repo has no wayfinder map for this work.
- **A real issue tracker (GitHub, Linear, …)** → publish one issue per ticket in dependency order (blockers first) so each ticket's blocking edges can reference real identifiers. Use the platform's native blocking / sub-issue relationship where it has one; otherwise set each ticket's "Blocked by" to the blocking issues. Apply the `ready-for-agent` triage label unless instructed otherwise — the tickets are agent-grabbable by construction.

Do NOT close or modify any parent issue.

### Publishing into a chartr map

Ask which map the tickets belong to if it is not already obvious, and never invent a
new map here — charting a map is `/wayfinder`'s job, not this skill's. Write into the
existing `.plan/maps/<effort>/` (or its `<effort>-impl/` sibling when the planning map
should stay plan-only).

<chartr-ticket-template>

```markdown
---
type: task
blocked_by: [01, 02]
---
# <Ticket title>

## Question

The end-to-end behaviour this ticket makes work, from the user's perspective, stated as
the thing it has to answer. Workable cold by a session that has read nothing else.

## Done when

- The concrete condition that says it is finished.
- One line per acceptance criterion.
```

</chartr-ticket-template>

The rules chartr enforces, each of which has bitten a real session:

- **Never write a `## Answer` or `## Ruled out` heading on a ticket you are filing.** Not
  even an empty one as a placeholder for the next session to fill. Status is *derived*: a
  closing heading with prose under it resolves the ticket, and a closing heading with
  nothing under it is a malformation that reads as a session that died mid-write. A fresh
  ticket ends after `## Done when`. The resolving session adds the heading and its prose in
  the same edit.
- **Never write `status:`**, and never write `claimed_by` / `claimed_at` — filing is not
  claiming.
- **`NN` is permanent identity.** Number on from the highest existing ticket in that map,
  including resolved ones; never reuse or renumber. Filenames must match `NN-slug.md`
  exactly, or chartr drops the ticket from the map entirely.
- **Blocking edges live in `blocked_by`, as ticket numbers** — not as a prose "Blocked by"
  section, not as titles. Every number must name a ticket that exists in the same map.
  Empty list means it can start immediately. Only a *resolved* blocker clears an edge, so
  never point `blocked_by` at a ticket you expect to be ruled out of scope.
- **`type` is one of `task | grilling | research | prototype`.** Tracer-bullet build slices
  are `task`.
- **Do not list the new tickets in the map's `## Decisions so far`** — that section indexes
  only resolved tickets. If the map needs to mention what was just filed, put it in
  `## Notes`.
- **If these are build tickets on a planning map, `## Notes` on `map.md` must say so**
  explicitly. wayfinder's default is plan-don't-do and it permits the override only there.
- **Any fog patch in `## Not yet specified` that these tickets just sharpened should
  graduate** into one of them in the same edit, and its `clears-with:` anchor must still
  name an open ticket.

Commit the tickets on their own, separate from any code, with the map commit type for this
repo (`map(<effort>): …`).

<tickets-file-template>

# Tickets: <short name of the work>

A one-line summary of what these tickets build. Reference the source spec if there is one.

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom.

## <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the user's perspective — not a layer-by-layer implementation list.

**Blocked by:** the titles of the tickets that gate this one, or "None — can start immediately".

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2

## <Ticket title>

...

</tickets-file-template>

<issue-template>

## Parent

A reference to the parent issue on the tracker (if the source was an existing issue, otherwise omit this section).

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective — not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- A reference to each blocking ticket, or "None — can start immediately".

</issue-template>

In every form, avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

Work the frontier one ticket at a time with `/implement`, clearing context between tickets.
</content>
