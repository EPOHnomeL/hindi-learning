# OpenRouter client + bundled authoring assets

Status: ready-for-agent

> Shared infrastructure for every OpenRouter action (authoring + translation).
> See [`../PRD.md`](../PRD.md).

## What to build

The two pieces of shared plumbing the OpenRouter actions need, both mockable so
downstream slices can be tested without a live model.

- **OpenRouter client** — a thin, env-configured wrapper over OpenRouter's
  OpenAI-compatible chat-completions endpoint, with a single seam that tests can
  mock. Reads a single operator `OPENROUTER_API_KEY` and model slugs from env
  (`OPENROUTER_AUTHOR_MODEL`, `OPENROUTER_TRANSLATE_MODEL`) with sane defaults;
  supports enabling web search via OpenRouter's `web` plugin. No per-user keys.
- **Bundled authoring assets** — a `pnpm` build script that reads the canonical
  source files (the `teach` skill instructions: `SKILL.md` + `AUTHORING.md` +
  the `*-FORMAT.md` docs, and the `lessons/_partials/{head,foot}.html`) and
  emits a generated TypeScript module the filesystem-less Convex action can
  import. The generated file must be reproducible from source so it cannot
  silently drift; regenerating on unchanged sources is a no-op.

Confirm the exact OpenRouter slugs for GLM 4.2 and Gemini 3.5 Flash (and that
they support tool/web-search) as part of this slice, wiring them as the env
defaults.

## Acceptance criteria

- [ ] The client reads key + model slugs from env and exposes a mockable call seam.
- [ ] The client can enable web search (OpenRouter `web` plugin) per call.
- [ ] A build script regenerates the bundled-assets module from the source files; output is deterministic and a no-op when sources are unchanged.
- [ ] The generated module contains the verbatim teach instructions and head/foot partials.
- [ ] Exact GLM 4.2 / Gemini 3.5 Flash slugs are confirmed and set as env defaults.
- [ ] Unit test covers the client against a mocked endpoint; a one-off `convex run` smoke call against the real endpoint is documented.

## Blocked by

- [01 — Provider choice + fire-routing skeleton](./01-provider-choice-and-fire-routing-skeleton.md)
