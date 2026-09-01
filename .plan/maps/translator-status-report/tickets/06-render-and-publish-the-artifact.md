---
type: task
blocked_by: [04, 05]
---
# Render the page and publish it as an artifact

## Question

Turn 04's JSON into 05's agreed page, and publish it as a Claude Artifact.

The division of labour is the point: **the numbers come from the query, the words from
the agent, and the agent never computes a figure.** Everything numeric on the page
traces to a field 04 returned.

- The renderer takes 04's JSON and emits one self-contained HTML file: inlined CSS, an
  inline SVG chart, no external requests (an artifact's CSP blocks them).
- Theme-aware and print-friendly per the artifact contract: a full light palette on
  bare `:root`, dark overrides in both the `prefers-color-scheme` and `[data-theme]`
  forms, and an explicit `body` background.
- The as-of stamp from 05 is rendered, not optional.
- Published with `favicon`, a stable `<title>`, and a one-sentence `description`. Each
  run publishes a **fresh** artifact and reports its URL; there is no stored URL and no
  update-in-place (map Out of scope).

Decide here whether the renderer is a script the run executes (deterministic, testable,
recommended) or prose instructions the agent follows each week. The first is the
`/ponytail` answer and keeps the page from drifting week to week.

**The page carries PII**: fourteen real names, their email addresses, YWAM Potch's
income and the platform split. It must not be written into the repo, and any fixture or
test data uses invented names.

## Done when

- Given 04's JSON, a single self-contained HTML file is produced that matches 05.
- It renders correctly in light and dark, and prints without a horizontally scrolling
  body.
- Published once as a real artifact and opened, with the URL in the Answer.
- If the renderer is a script, it has tests over at least the empty-data case, a
  single-language case, and the full fourteen.
- No real name, email or figure has entered a committed file.

## Ruled out

**Superseded on 2026-09-01 by the course Dashboard tab.** No artifact is rendered and
none is published, so there is nothing to render 04's JSON into and nothing for 05 to
have designed. React components in the app read an owner-gated query directly.

The division of labour this ticket was built to protect ("the numbers come from the
query, the words from the agent, and the agent never computes a figure") is satisfied
trivially once the agent is gone: there are no words and no agent, only the query.
