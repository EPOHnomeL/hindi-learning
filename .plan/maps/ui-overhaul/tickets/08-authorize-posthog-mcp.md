---
type: task
blocked_by: [07]
---
# Authorize the PostHog MCP connector

> `/wayfinder .plan/maps/ui-overhaul/tickets/08-authorize-posthog-mcp.md`

## Question

HITL setup, same shape as ticket 01. The claude.ai PostHog connector already exists
but is unauthenticated, and no agent can run the OAuth flow for the human. It matters
because with it ticket 13 is largely AFK (an agent queries events and recordings
directly); without it, 13 is a human trawling dashboards.

## Todo

- [ ] In **claude.ai connector settings**, authorize the PostHog connector against
      ticket 07's project. Not `claude mcp`; this one is a claude.ai connector.
- [ ] Confirm it points at the **EU** instance, not the US default.
- [ ] In a fresh session, list projects and query any event. Authenticated but empty
      is a pass until ticket 10 ships; an auth error is not.

## Done when

The tools are callable against the EU project in a fresh session, and the Answer
names which came back and which are read-only or missing.
