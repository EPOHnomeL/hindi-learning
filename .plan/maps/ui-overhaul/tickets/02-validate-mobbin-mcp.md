---
type: prototype
blocked_by: [01]
---
# Validate the Mobbin MCP on one real surface

> `/wayfinder .plan/maps/ui-overhaul/tickets/02-validate-mobbin-mcp.md`

## Question

The MCP is in beta and the sub is monthly precisely so this can fail cheap: does
reference-driven output actually beat the agent's unaided taste? Pull Mobbin
references for one weak surface, build a throwaway redesign prototype against them,
and react to it: is the difference worth ~€10/month?

Ticket 04 recommends the **Paygate** (`src/app/_components/Paygate.tsx`, 365 lines)
as the target — small enough to prototype whole, the thinnest mobile treatment of any
learner surface (`md:` ×2), and "checkout on a phone" is the richest category in
Mobbin's library.

## Done when

The Answer records a verdict — MCP references materially improved the prototype or
they didn't — plus the billing decision that follows (switch to yearly, stay
monthly, or cancel), with the prototype linked as an asset.
