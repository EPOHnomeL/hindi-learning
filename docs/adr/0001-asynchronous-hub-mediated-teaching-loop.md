# Asynchronous, hub-mediated teaching loop (no live tutor on the web)

The teach skill's interactivity normally comes from a *live* Claude Code session acting as the teacher. We deliberately do **not** put an LLM in the served web app. Instead the web serves static-rendered Lessons (no server-side rendering, no model — but with client JS that POSTs to the worker), captures learner Responses and Questions into Neon, and Claude Code closes the loop *asynchronously* by reading that signal via the Neon MCP and authoring the next round. The "back and forth" is real but DB-mediated and delayed, not a real-time chat.

## Considered Options

- **Live AI tutor on the web** (Claude API via the Hono worker, lesson loaded as context). Most faithful to the skill's real-time feel, but adds key management, per-message cost, and a second place where teaching logic lives.
- **Static lessons only**, no return path. Cheapest, but degrades to read-only artifacts and loses the conversation entirely.
- **Chosen: async, hub-mediated.** No LLM on the web; Neon is the channel; Claude Code remains the only teacher.

## Consequences

- The web app needs no model credentials and has no per-interaction LLM cost.
- Replies to Questions are delayed until the next Claude Code session — acceptable for a single-learner study tool, would not be for a real-time product.
- All teaching intelligence (zone-of-proximal-development, what to teach next) stays in Claude Code; the web is a deliberately "dumb" reader + capture surface.
