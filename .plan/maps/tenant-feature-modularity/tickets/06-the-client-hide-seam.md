---
type: prototype
blocked_by: []
---
# The client hide seam, and the flash

## Question

Making an off feature disappear is the user's central ask, and there is exactly one working example
in the tree to reason from: `donations`. It hides two ways, both hand-rolled. The route does
`if (!tenant?.flags.donations) notFound()` in `src/app/donate/page.tsx`, and the section does
`const ready = Boolean(slug && tenant?.flags.donations && config)` in `DonateSection.tsx`. Ten more
switches hand-rolled the same way is ten more places to get the loading state wrong.

**The flash is the real problem, and it is structural.** `TenantContext` resolves flags through a
plain reactive `useQuery(api.tenants.getTheme)`, and its own comment says this is deliberate:
*"the logo, brand name, and feature flags are flash-tolerant, so, unlike the no-flash palette baked
into the layout style, they ride a plain reactive useQuery here."* That was true when nothing
rendered off a flag. It stops being true the moment a Buy button, a Claim certificate button and a
Translate tab all appear a beat after paint and then vanish. The palette solved this by being
SSR-fetched and inlined before paint; flags have no such path today.

So there are two questions, and they are entangled, which is why this is one prototype ticket:

1. **What is the seam?** A `<Feature flag="selling">` wrapper component, a `useFlag("selling")`
   hook, a route-level guard like the one on `/donate`, or some combination. Nav items, tabs,
   buttons, whole routes and server components are all consumers, and a server component cannot use
   a hook at all. Name what each consumer kind uses.
2. **What does it render while `flags` is `undefined`?** Three options, and they look completely
   different: render nothing until resolved (a hole that fills in), render optimistically and hide
   on arrival (today's flash, at scale), or move flags onto the SSR path beside the palette so
   there is no undefined state on first paint. The third is the most work and the only one with no
   flash.

**Build something the operator can look at before deciding.** Per CLAUDE.md, a prototype is not
decided until a human has actually seen it. An Artifact showing the three loading behaviours side
by side on a realistic tenant home (a card grid with a Buy button, a Translate tab, a Claim
certificate button) costs nothing to redo and touches no working tree. Only write files under
`assets/` once there is a real reaction to react to.

## Done when

- The operator has **seen** the three loading behaviours, not read a description of them, and
  picked one.
- The seam is named, with a specific answer for each consumer kind: client component, server
  component, route, nav item, tab.
- If SSR flags win, the Answer says how they reach the layout without a second Convex round trip,
  given that `getTheme` is already fetched server-side there for the palette.
- The Answer states plainly that the client hide is **cosmetic** and `assertTenantFlag` remains the
  enforcement, so [09](09-build-hide-the-existing-five.md) onward never quietly drop a server gate.
