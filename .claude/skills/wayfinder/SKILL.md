---
name: wayfinder
description: Plan a huge chunk of work — more than one agent session can hold — as a shared map of investigation tickets on your issue tracker, and resolve them one at a time until the way to the destination is clear.
disable-model-invocation: true
---

A loose idea has arrived — too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **shared map** on the repo's issue tracker, then works its tickets one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting — it shapes every ticket. It might be a spec to hand off and iterate on, a decision to lock before planning starts, or a change made in place like a data-structure migration. The map is domain-agnostic — engineering work, course content, whatever fits the shape.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear — nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off. An effort can override this in its **Notes** — carrying execution into the map itself — but absent that, produce decisions, not deliverables.

## Refer by name

Every map and ticket is an issue, so it has a **name** — its title. In everything the human reads — narration, the map's Decisions-so-far — refer to it by that name, never by a bare id, number, or slug. A wall of `#42, #43, #44` is illegible; names read at a glance. The id and URL don't vanish — a name wraps its link — but they ride *inside* the name, never stand in for it.

## The Map

The map is a single issue on this repo's issue tracker, labelled `wayfinder:map` — the canonical artifact. Its tickets are child issues of the map.

The map is an **index**, not a store. It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place — its ticket — so the map never restates it, only gists it and links.

**Where the map, its child tickets, blocking, and frontier queries physically live is tracker-specific.** The issue tracker should have been provided to you — run `/setup-matt-pocock-skills` if not. Consult the tracker doc's "Wayfinding operations" section for how _this_ repo expresses them. If no tracker has been provided, default to the local-markdown tracker.

### The map body

The whole map at low resolution, loaded once per session. Open tickets are **not** listed — they are open child issues, found by query.

```markdown
## Destination

<what reaching the end of this map looks like — the spec, decision, or change this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [<closed ticket title>](link) — <one-line gist of the answer>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
```

### Tickets

Each ticket is a **child issue** of the map; the tracker's issue id is its identity. Its body is the question, sized to one 100K token agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Each ticket carries a `wayfinder:<type>` label — one of `research`, `prototype`, `grilling`, `task` (see [Ticket Types](#ticket-types)).

A session **claims** a ticket by assigning it to the dev driving the map, **first**, before any work, so concurrent sessions skip it. That assignee _is_ the claim: an open, unassigned ticket is unclaimed.

Blocking uses the tracker's **native** dependency relationship — essential because it renders the frontier _visually_ in the tracker's own UI, so the human sees what's takeable without opening the map. Only a tracker that lacks native blocking falls back to a body convention. A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed children — the edge of the known.

The answer isn't part of the body — it's recorded on resolution (see [Work through the map](#work-through-the-map)). Assets created while resolving a ticket are linked from the issue, not pasted in.

## Ticket Types

Every ticket is either **HITL** — human in the loop, worked *with* a human who speaks for themselves — or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side of it (a grilling agent that answers its own questions has broken this).

- **Research** (AFK): Reading documentation, third-party APIs, or local resources like knowledge bases. Creates a markdown summary as a linked asset. Use when knowledge outside the current working directory is required.
- **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to — an outline, a rough take, a stub, or UI/logic code via the /prototype skill. Links the prototype as an asset. Use when "how should it look" or "how should it behave" is the key question.
- **Grilling** (HITL): Conversation via the /grilling and /domain-modeling skills, one question at a time. The default case.
- **Task** (HITL or AFK): Manual work that must happen before a *decision* can be made — nothing to decide, prototype, or research, but the discussion is blocked until it's done. Signing up for a service so its API can be judged, provisioning access, moving data so its shape can be seen. This is the one type that *does* rather than decides — and it earns its place by unblocking a decision, not by delivering the destination. The agent drives it alone where it can (AFK); otherwise it hands the human a precise checklist (HITL). Resolved when the work is done; the answer records what was done and any resulting facts (credentials location, new URLs, row counts) later tickets depend on.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **fog of war** — the dim view of decisions and investigations you can tell are coming but can't yet pin down, because they hang on questions still open. Resolving a ticket clears the fog ahead of it, graduating whatever's now specifiable into fresh tickets — one at a time, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written down: the suspected question, the area to revisit later. It's the undiscovered frontier _toward_ the destination — everything here is in scope, just not sharp enough to ticket. Write as loosely or as fully as the view allows; it doubles as a signpost for collaborators reading where the effort is headed.

**Fog or ticket?** The test is whether you can state the question precisely now — _not_ whether you can answer it now.

- **Ticket when** the question is already sharp — even if it's blocked and you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice the fog into ticket-sized pieces: it's coarser than a ticket, and one patch may graduate into several tickets, or none, once the frontier reaches it.

**Not yet specified** excludes what's already decided (Decisions so far), what's already a live ticket, and what's out of scope (the next section).

## Out of scope

Fog only ever gathers _toward_ the destination. The destination fixes the scope, so work beyond it is **out of scope** — it isn't fog, and it doesn't belong in **Not yet specified**. It gets its own **Out of scope** section on the map: work you've consciously ruled out of _this_ effort. Scope, not sharpness, lands it here.

Out-of-scope work never graduates — the frontier stops at the destination — so it returns only if the destination is redrawn, and then as a fresh effort, not a resumption.

Ruling something out of scope is a scoping act, not a step on the route. When a ticket that already exists turns out to sit past the destination — mis-scoped in while charting, or exposed by a resolution — **close it** (a closed ticket is unambiguously off the frontier) and leave one line in the **Out of scope** section: the gist plus why it's out of scope, linking the closed ticket. It stays out of **Decisions so far**, which records the route actually walked — a scope boundary isn't a step on it.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session.**

### Chart the map

User invokes with a loose idea.

1. **Name the destination.** Run a `/grilling` and `/domain-modeling` session to pin down what this map is finding its way to — the spec, decision, or change. The destination fixes the scope, so it's settled first.
2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** — the way to the destination is already clear, the whole journey small enough for one session — you don't need a map. Stop and ask the user how they'd like to proceed.
3. **Create the map** (label `wayfinder:map`): Destination and Notes filled in, Decisions-so-far empty, the fog sketched into **Not yet specified**.
4. **Create the tickets you can specify now** as child issues of the map — then wire blocking edges in a **second pass** (issues need ids before they can reference each other). Wiring sorts them into the frontier and the blocked; everything you can't yet specify stays in the fog — the **Not yet specified** section.
5. Stop — charting the map is one session's work; do not also resolve tickets.

### Work through the map

User invokes with a map (URL or number). A ticket is **optional** — without one, you pick the next decision, not the user.

1. Load the **map** — the low-res view, not every ticket body.
2. Choose the ticket. If the user named one, use it. Otherwise take the first frontier ticket in order. **Claim it**: assign it to yourself before any work.
3. Resolve it — **zoom as needed**: fetch the full body of any related or closed ticket on demand; invoke the skills the `## Notes` block names. If in doubt, use `/grilling` and `/domain-modeling`.
4. Record the resolution: post the answer as a **resolution comment**, **close** the issue, and **append a context pointer** to the map's Decisions-so-far.
5. Add newly-surfaced tickets (create-then-wire); graduate any fog the answer has made specifiable, clearing each graduated patch from **Not yet specified** so it lives only as its new ticket. If the answer reveals a ticket — this one or another — sits beyond the destination, **rule it out of scope** rather than resolving it on the route. If the decision invalidates other parts of the map, update or delete those tickets.

The user may run unblocked tickets in parallel, so expect other sessions to be editing the tracker concurrently.

## The reader's contract — write only what chartr can read

Everything above describes intent. This section describes **what the reader actually
parses**, derived from chartr's `internal/mapscan/mapscan.go`, `internal/wayfinder/parse.go`
and `internal/wayfinder/lint.go`. The reader is the authority: a map is what it says it is,
and anything it cannot parse either vanishes or is surfaced as a malformation. Write to this
contract, not to the spirit of the sections above.

### Discovery — where a map may live

- **`.plan/` is the one fixed point.** Anything outside it is invisible to the reader,
  whatever it is named.
- **A map is any directory under `.plan/` that *directly* contains a `map.md`.** Discovery is
  a recursive walk, so depth does not matter: `.plan/<slug>/` and `.plan/maps/<slug>/` are
  both found, and so is any other nesting.
- **Finding a `map.md` stops the descent into that directory.** A map therefore cannot
  contain another map — a stray `map.md` under a map's `tickets/` or `assets/` is invisible.
- **A directory with no `map.md` is simply not a map**, which is the only reason
  `.plan/handoffs/` and `.plan/research/` stay off the board. There is no exclusion list.
- **Corollary — you cannot retire a map by relocating it inside `.plan/`.** Moving a finished
  effort to `.plan/maps-done/<slug>/` still leaves a discoverable `map.md` under `.plan/`, so
  it stays on the board. Only moving it out of `.plan/` entirely removes it.
- The **slug** is the directory's basename. The **name** is the map's first `# ` heading,
  falling back to the slug.

### Tickets — what counts as one

- Tickets are read from `<map>/tickets/*.md`, **non-recursively**; subdirectories are ignored.
- **The filename must match `NN-slug.md`** (`^(\d+)-(.+)\.md$`). Anything else is not a
  ticket: it is reported as a malformation and **dropped from the map entirely** — it will
  not count toward progress, will not satisfy a `blocked_by`, and will not appear anywhere.
- Leading zeros are stripped, so `01` and `1` are the same number. Two files claiming one
  number is an error.
- A map with **no `tickets/` directory at all is normal** (a freshly charted map) and yields
  no complaint.

### Ticket frontmatter

- Frontmatter is a `---` delimited block whose **opening `---` must be the very first line of
  the file**, with a closing `---` below it. If line 1 is anything else — a stray key, a
  comment, a blank line — the block is not parsed at all and the file silently falls back to
  a legacy regex mode that only recognises `Type:`, `Status:` and `Blocked by:`. **A
  `claimed_by` written above the opening `---` does not exist**, and the ticket reads as
  unclaimed and untyped.
- Recognised keys: `type`, `claimed_by`, `claimed_at`, `assets`, `blocked_by`,
  `undermined_by`, and the deprecated `status`. Unknown keys are ignored silently.
- `type` must be exactly one of `research | prototype | grilling | task`.
- `blocked_by` / `undermined_by` take a bracketed or bare comma list; empty or `none` means
  none. **A non-numeric entry fails the parse and drops the whole ticket.**
- `claimed_at` must be RFC 3339. A claim older than 72h is flagged as a probable dead session.
- **Never write `status:`** — it is derived. A stored one that disagrees with the body is an
  error, and one that agrees is still a warning to delete it.
- An H1 title is required; the skill refers to tickets by name.

### Status is derived, in this precedence

1. `## Answer` **with prose under it** → resolved
2. `## Ruled out` **with prose under it** → out_of_scope
3. a non-empty `claimed_by` → claimed
4. otherwise → open

- **A closing heading with nothing under it resolves nothing** and is an error — it reads as
  a session that died mid-write, not as a finished ticket.
- Headings match the **exact trimmed string** `## Answer` / `## Ruled out`. `### Answer`,
  `## Answer:` and `## answer` do not match and settle nothing. Any other heading — a
  `## Proposed Answer`, say — is unknown to the reader and leaves the ticket open.
- Carrying both closing headings is an error: a ticket is a step on the route or a boundary
  of it, never both.
- **Fenced code blocks are blanked before structure is detected**, so a ticket may quote this
  format without resolving itself.
- Out-of-scope is closed, but **only `resolved` satisfies a `blocked_by` edge** — a ticket
  blocked by one that was ruled out can never unblock, and is warned about.

### The frontier

Open tickets whose every `blocked_by` names an existing ticket that is **resolved**. A
`blocked_by` pointing at a missing ticket, at itself, or forming a cycle is an error.

### The map body

- **`## Destination` is required and must be non-empty.**
- **`## Decisions so far` is a load-bearing index, not prose.** Every resolved ticket must be
  linked from it as `(tickets/NN-…)` or `(./tickets/NN-…)`; a resolved ticket missing from it
  errors with *"the map is the index and it now lies"*. A link here to a ticket that is not
  resolved is equally an error, and listing one twice is a warning.
- Every out-of-scope ticket must likewise be linked from **`## Out of scope`**.
- **`## Not yet specified`** holds fog as top-level `- ` bullets. Each needs a **bolded lead
  title** (`- **Title** — …`) or it has no identity to render. A fog title that matches a live
  ticket's title case-insensitively is an error — the same question tracked twice. An optional
  `clears-with: NN` must name a ticket that is not yet resolved.
- Section bodies run from the heading to the next `## `, so heading order and exact spelling
  matter.

### What "finished" means

A map is finished when it has at least one ticket and **all** of them are closed. Finished
maps sort last in the sidebar automatically — that segregation is already done for you, so
a completed effort left in place is not clutter the reader is failing to handle.
