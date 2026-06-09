# Reader prototype (THROWAWAY)

**Question:** What should the Served Teach App *reader* look and feel like?

Three structurally different variants on one app, switchable via `?variant=` and a
floating bottom bar (or ← / → keys). Mock data only — no Neon, no R2, no auth.

Run: `pnpm prototype` → open the printed URL (default http://localhost:5174).

| Variant | Key | Idea | Defining affordance |
|---------|-----|------|---------------------|
| A | `?variant=A` | **Quiet Reader** | One narrow centered column, study-Bible feel; lessons as a plain list |
| B | `?variant=B` | **Workstation** | Three panes; the question/reply thread lives in a permanent right rail |
| C | `?variant=C` | **Pocket Deck** | Phone-shaped, card deck with progress rings, bottom tabs + Ask FAB |

What each variant exercises: opening a lesson marks Progress `opened`; the inline
quiz captures a Response with immediate right/wrong feedback; "Mark complete" →
`completed`; the "ask my teacher" box adds an `open` Question; the thread shows
`open` vs `answered` (with Reply) states. Two questions are pre-seeded (one answered).

## Verdict

- **Winner: B — Workstation, made mobile-first / responsive.** Desktop keeps the
  three-pane workstation with the Q&A thread in a permanent right rail; on small
  screens it collapses to a single-column flow with nav and thread as
  sheets/tabs (borrowing C's mobile patterns). Mobile is the priority breakpoint.
- Decided: 2026-06-09, from the reader prototype.
- Next: build the real reader from this direction once slice 0 (Cloudflare/Neon/
  R2/Access) exists. Then delete this `prototype/` folder.
