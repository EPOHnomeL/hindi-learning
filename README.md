# My Course

An AI-tutored course platform, heading toward a **whitelabel course-generator
LMS** (one codebase, multiple branded tenant sites). Claude (via the `teach`
skill) authors lessons; a Next.js reader backed by Convex serves them to learners
on any device and feeds answers/questions/progress back.

- **Domain model & vocabulary** → [CONTEXT.md](CONTEXT.md)
- **How to work in this repo** (conventions, workflow) → [CLAUDE.md](CLAUDE.md)
- **Project facts** (environments, deploy, payments, whitelabel) →
  [docs/agents/project-context.md](docs/agents/project-context.md)
- **Decisions** → [docs/adr/](docs/adr)

## Stack

- **Next.js (App Router)** + Tailwind — the reader.
- **Convex** — database, server functions, realtime, and file storage (the
  "Hub"; the source of truth for content since ADR 0009).
- **Convex Auth** — email/password sign-in.
- **tsx** — runs the operator/teach CLIs (`publish` / `review` / `reply`).

## First-time setup

```bash
pnpm install

# 1) Create the Convex deployment + generate convex/_generated (interactive;
#    logs you into Convex and writes NEXT_PUBLIC_CONVEX_URL to .env.local).
npx convex dev            # leave running in its own terminal

# 2) One-time: set up Convex Auth keys (JWT private key + JWKS) in the deployment.
npx @convex-dev/auth

# 3) Pick a publish secret and set it in BOTH places:
npx convex env set PUBLISH_SECRET "<a-long-random-string>"
#    then add the same line to .env.local:  PUBLISH_SECRET="<same-value>"

# 4) Run the reader.
pnpm dev                  # http://localhost:3000  (another terminal)
```

## The teach loop

- `pnpm run publish` — push new/changed lessons & references to Convex.
- `pnpm run review` — read a learner's open questions, quiz responses, progress.
- `pnpm run reply <question-id> "<answer>"` — answer a question (shows in reader).

## Deploy (Vercel)

Push to `main` — the Vercel GitHub integration builds a production deployment,
and the build command (`npx convex deploy --cmd 'pnpm run build'`) also pushes
Convex functions + schema to prod. See
[docs/agents/project-context.md](docs/agents/project-context.md) for the full
deploy/environments picture.
