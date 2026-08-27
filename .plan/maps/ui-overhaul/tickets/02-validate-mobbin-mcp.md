---
type: prototype
blocked_by: [01]
---
# Is the Mobbin MCP worth keeping

> `/wayfinder .plan/maps/ui-overhaul/tickets/02-validate-mobbin-mcp.md`

## Question

Yes or no: does reference-driven output beat the agent's unaided taste by enough to
justify ~EUR 10 a month? The MCP is beta and the sub is monthly precisely so this can
fail cheap.

Pull references for one weak surface, build a throwaway redesign against them, and
react to it. Target is the **Paygate** (`src/app/_components/Paygate.tsx`, 365
lines): small enough to prototype whole, the thinnest mobile treatment of any learner
surface, and checkout-on-a-phone is the richest category in Mobbin's library.

## Done when

The Answer says yes or no, names the billing consequence (switch to yearly, stay
monthly, cancel), and links the prototype under `assets/`.
