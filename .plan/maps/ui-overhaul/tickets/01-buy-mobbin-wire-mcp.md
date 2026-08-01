---
type: task
---
# Buy Mobbin Pro and wire the MCP into Claude Code

> `/wayfinder .plan/maps/ui-overhaul/tickets/01-buy-mobbin-wire-mcp.md`

## Question

Manual (HITL) setup that every reference-driven ticket on this map waits on. The
decision to buy is already made (grilling, 2026-08-01): **Pro, monthly billing** —
yearly only after ticket 02 validates the MCP. Checklist for the human:

1. Subscribe to Mobbin **Pro** on **monthly** billing at <https://mobbin.com>.
2. In a terminal: `claude mcp add mobbin` (remote endpoint `https://api.mobbin.com/mcp`).
3. Open a fresh Claude Code session, select the Mobbin MCP server, authenticate via
   the browser login with the Mobbin account.
4. Sanity-check: ask the agent to pull a few reference screens (e.g. "bottom sheet
   examples from iOS learning apps") and confirm images come back.

## Done when

The Mobbin MCP tools are callable and authenticated in a fresh Claude Code session,
and the Answer records the plan/billing bought and where the account lives.
