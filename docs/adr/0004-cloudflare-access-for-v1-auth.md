# Cloudflare Access for v1 authentication

> Status: superseded by ADR-0006 (Neon Auth). Kept for the reasoning trail.

v1 is a single-learner app deployed on Cloudflare, so we gate the whole app with **Cloudflare Access** (identity-based, "only this person gets in") rather than writing in-app auth. This means zero auth code, no sessions table, no password or magic-link handling for v1. The schema still scopes every row by `user_id` so that moving to in-app accounts later is additive, not a migration.

## Considered Options

- **In-app magic link** — keeps auth inside the app, smaller leap to multi-user, but needs an email integration and a sessions table now.
- **Shared password / passkey** — simplest secret or most secure respectively, but either weak or fiddly for an audience of one.
- **Chosen: Cloudflare Access** — least code for a real, secure gate, native to the deployment target.

## Consequences

- No auth code ships in v1; access is configured in Cloudflare, gated to a single identity.
- Cloudflare Access gates the *entire* app to one person — the day real multi-user accounts are needed (the "teach me anything" future), this is replaced by in-app auth (magic link). The retained `user_id` scoping makes that change additive.
