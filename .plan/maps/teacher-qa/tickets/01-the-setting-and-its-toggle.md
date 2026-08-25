---
type: task
blocked_by: []
---
# The Teacher Q&A setting exists, and the owner can flip it

## Question

A course owner opens their Editions panel, lands on the source language tab, and finds a switch
labelled for **Teacher Q&A** sitting beside Publish and the public link. They flip it off. It stays
off across a reload, and it says plainly that it governs the whole course in every language rather
than just the Edition whose tab it sits on.

Nothing hides yet. This ticket lays the rail: the stored setting, the mutation that writes it, the
control that drives it, and the value arriving in the reader where tickets 02 and 03 will consume
it. Read [spec.md](../spec.md) first, particularly **Implementation Decisions**.

Two things it must get right, because everything downstream rests on them:

- **Absence means on.** The setting is an optional boolean on the **Topic**. A Topic that has never
  had it written must read exactly as one with it explicitly on. There is no migration, no backfill,
  and no default written onto existing rows. This is the whole reason the effort is cheap.
- **The reader needs the boolean itself, not an inference.** An empty question list is ambiguous: an
  owner who has simply never asked anything also has none, and that owner must still see the ask
  form. So the flag has to ride the course bundle the reader already loads. Deciding which existing
  query carries it is part of this ticket, and the answer belongs in the resolution.

The setting is **per Topic**, so it does not belong in the module that owns Edition-grained
publishing, nor in the per-tenant feature flag machinery, whose semantics are wrong here. It belongs
beside the Q&A behaviour it governs.

Leave the `qa` tenant feature flag completely alone.

## Done when

- An optional boolean lives on the Topic document, with a comment explaining that its absence means
  on and that it is distinct from the `qa` tenant feature flag.
- An owner-only mutation sets it, resolving the Topic through the same owner-only path publishing
  uses.
- A Viewer, an Editor, a Translator and a tenant Admin are each refused by that mutation, with tests.
- A Topic that has never had the field written reads as on, with a test. This is the single most
  important assertion in the effort.
- The toggle renders on the source language tab of the Editions dialog only, styled as the existing
  Publish and public link toggles are and reusing their row shape.
- Its label and hint say unambiguously that the setting applies to the whole course in every
  language, not to the Edition whose tab it sits on.
- Every string is keyed under the Editions namespace and present in all `messages/*.json`
  catalogues, following how the neighbouring toggles are keyed.
- Flipping the toggle updates reactively and survives a reload.
- The boolean reaches the reader on a course bundle query, and the resolution names which query
  carries it so tickets 02 and 03 can consume it without re-deciding.
- No change to `tenants.flags`, to the tenant flag helper, or to the admin portal.
- `pnpm typecheck` is green and the Convex suite passes.
