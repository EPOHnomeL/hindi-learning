---
type: task
blocked_by: [07]
---
# Authorize the PostHog MCP connector

> `/wayfinder .plan/maps/ui-overhaul/tickets/08-authorize-posthog-mcp.md`

## Question

Manual (HITL) setup, the same shape as ticket 01 does for Mobbin. A **claude.ai
PostHog connector already exists but is unauthenticated** — it shows up in sessions
as requiring authorization, and no agent can run the OAuth flow on the human's
behalf.

This exists so that ticket 13 — naming the clunky flows from evidence — is largely
**AFK**: an agent queries events, lists session recordings and pulls funnels
directly, and brings findings back. Without it, 13 is fully HITL and bottlenecked on
the human trawling dashboards and relaying what they saw. This map is explicitly
agent-driven, so that difference matters.

Checklist for the human:

1. In **claude.ai → connector settings**, authorize the PostHog connector against
   the EU project from ticket 07. (Not `claude mcp` — this one is a claude.ai
   connector, unlike Mobbin's.)
2. Make sure it points at the **EU** instance, not the US default.
3. Sanity-check in a fresh session: ask an agent to list projects and query any
   event. Expect an empty result until ticket 10 ships — an authenticated-but-empty
   response is a pass, an auth error is not.

## Done when

The PostHog MCP tools are callable and authenticated in a fresh session against the
EU project, and the Answer records which tools came back and any that are read-only
or unavailable.
