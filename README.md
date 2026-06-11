# Hindi — Served Teach

A personal, AI-tutored learning workspace + reader. Claude (via the `teach`
skill) authors lessons in this repo; a Next.js reader (backed by Convex) serves
them to the learner on any device and feeds answers/questions back. See
[PRD.md](PRD.md) for the full concept and [docs/adr](docs/adr) for decisions.

## Stack

- **Next.js (App Router)** + Tailwind + `@t3-oss/env-nextjs` — the reader.
- **Convex** — database, server functions, and realtime (the "Hub").
- **Convex Auth** — email/password sign-in (no JWT/cookie plumbing).
- **tsx** — runs the teach CLI (`publish` / `review` / `reply`).

Local workspace files are the source of truth:
`MISSION.md`, `lessons/*.html`, `references/*.html`, `learning-records/*.md`,
`GLOSSARY.md`. `pnpm run publish` mirrors lessons/references into Convex.

## First-time setup

```bash
pnpm install

# 1) Create the Convex deployment + generate convex/_generated (interactive,
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

Then publish the existing content and sign in:

```bash
pnpm run publish          # pushes lessons/ + references/ into Convex
```

Open the app, create an account, and the lessons appear.

## The teach loop

- `pnpm run publish` — push new/changed lessons & references to Convex.
- `pnpm run review` — read the learner's open questions, quiz responses, progress.
- `pnpm run reply <question-id> "<answer>"` — answer a question (shows in reader).

## Deploy (Vercel)

Push to GitHub, import the repo in Vercel, set `NEXT_PUBLIC_CONVEX_URL` (and run
`npx convex deploy` for the production Convex deployment). Convex Auth and the
reader need no other secrets in the app.
