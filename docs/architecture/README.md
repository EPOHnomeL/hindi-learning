# Architecture / Technical Overview

Interactive technical handoff doc for your codebase. Audience: engineers joining the team or picking up unfamiliar areas of the system.

## Running locally

From the **repo root** (so that the viewer can resolve `CONTEXT.md` and per-package `CONTEXT.md` files):

```sh
pnpm documentation
```

Then open <http://localhost:3000/docs/architecture/>.

The viewer fetches the Markdown sources under `docs/architecture/` at runtime and renders them client-side. There is **no build step** — edit the `.md` files and refresh the browser.

## Layout

```
docs/architecture/
├── README.md                  ← this file
├── index.html                 ← the viewer (hand-authored, self-contained)
├── overview.md                ← top-level diagram + system intro
├── contexts/                  ← one MD per domain context
│   ├── 01-ordering.md         ← most-developed context (exemplar)
│   ├── 02-billing.md
│   └── 03-fulfillment.md
└── sub-modules/               ← 3rd zoom level under specific contexts
    └── ordering/
        └── state-machine.md
```

Sub-modules are added whenever a context's depth genuinely warrants a third zoom level — typically a state machine, a webhook contract, or a specialised flow. The SPA nests them under their parent in the sidebar and the parent's frontmatter doesn't need to know about them; the registry lives in `index.html` (`SUBMODULES`).

When you add a new context or sub-module markdown file, register it in `index.html` (`CONTEXTS` / `SUBMODULES`) — there is no server-side directory listing.

## Authoring conventions

Every MD file uses YAML frontmatter that the viewer reads to position boxes, draw arrows, and tag status:

```yaml
---
slug: ordering
name: Ordering
position: 1
status: exemplar # exemplar | draft | stub
ownerPackages: [ordering]
externalIntegrations: [payment-gateway]
consumes: [catalog]
produces: [billing, fulfillment]
adrs: [0001, 0002]
---
```

`status` values:

- **exemplar** — fully filled in to the depth expected for new panels; use as a template.
- **draft** — has real content but known gaps; safe to read but verify against code.
- **stub** — placeholder only; the panel exists in the nav but the body has not been written.

Within the body:

- `[[term]]` markers are auto-linked to the glossary built from `CONTEXT.md` + every registered `packages/*/CONTEXT.md` (and `apps/*`/`ops/` if present) (the full list is `GLOSSARY_SOURCES` in `index.html`). Hover for inline definition; the right-hand sidebar lists everything.
- Mermaid diagrams render automatically — use fenced ` ```mermaid ` blocks. Click-through is set up two ways:

  - **`overview.md`** auto-injects clicks for every registered context node (`NODE_TO_SLUG` in `index.html`).
  - **Per-page** authors add inline directives at the bottom of the diagram body. Two helpers are exposed on `window`:

    - `fsNavigate("contexts/02-billing.md")` — navigates to another doc page.
    - `fsOpenCode("/packages/ordering/src/checkout.ts#L42")` — opens the inline code drawer, scrolled to the line. Path must start with a `CODE_PREFIXES` entry (`/packages/`, `/apps/`, `/ops/`, `/tooling/`, `/turbo/`).

    ```mermaid
    flowchart TD
      PEND[PENDING] --> OK[COMPLETED]
      click PEND call fsOpenCode("/packages/ordering/src/checkout.ts#L42") "Open placeOrder"
    ```

    If any `click ` directive is present in a diagram, the overview auto-injector is skipped (so per-page clicks always take precedence).

- **`stateDiagram-v2` blocks don't support `<br/>`.** Use a single-line label with a separator (e.g. `space`, `/`, `;`) instead. Flowchart and sequenceDiagram blocks do support `<br/>`.
- File-system links use repo-root-relative paths (e.g. `/packages/ordering/src/checkout.ts`).
- Cross-page links use relative markdown paths (`../sub-modules/ordering/state-machine.md`), not in-page anchors (`#ordering/state-machine`) — the SPA router only matches the former.

## Living-doc discipline

This doc is checked in and intended to stay accurate. When you touch a load-bearing cluster (see [`CLAUDE.md`](/CLAUDE.md) cluster map), update the matching panel. Stale panels are worse than missing ones — if you can't update, mark the panel `status: stub` and file an issue.

## Exemplar

Read [`contexts/01-ordering.md`](contexts/01-ordering.md) before authoring a new panel. It demonstrates the expected depth (Medium): summary, state machine, sequence diagram, sub-modules, consumed/produced interfaces, key files, gotchas, ADR refs.
