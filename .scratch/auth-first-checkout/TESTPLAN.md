# Test plan — auth-first checkout (issues 01–06, sandbox)

## Setup (once)

- Run locally: `pnpm dev` in the worktree (Convex dev deployment `judicious-marmot-580` is shared; don't push the branch).
- Dev env already has sandbox `PAYFAST_*` and `PAYFAST_MODE=sandbox`. **Set dev `SITE_URL=http://localhost:3000`** (it currently points at the branch preview alias; only checkout return/cancel URLs read it). Restore afterwards if needed.
- You need: a completed course with a priced Edition from a ready Seller, and its Public link. Reuse the existing dev one or price one via the admin/seller flows.

## The journey (the big one)

1. **Open sign-up** — incognito → `localhost:3000` → Sign in screen → toggle to Sign up → brand-new email NOT on the Allowlist → account created, dashboard renders.
   - ✅ No "This workspace is private" error. ✅ Dashboard shows **no "New course" card**.
2. **Buy routing, signed out** — new incognito window → open the Public link → click into a locked Lesson → **Unlock the full course**.
   - ✅ Navigates to `/courses/<slug>/lessons/<key>?buy=1` (+`lang` if not English) — not a dialog on the share page.
   - ✅ SignIn renders at that URL defaulting to **"Create account"** with purchase copy; the toggle still reaches Sign in.
3. **Sign up mid-buy** — create a fresh account there.
   - ✅ Lands on the **same locked lesson**, buy dialog **already open**: course + price, **no email field**.
4. **Pay** — Continue to PayFast → sandbox checkout shows the right amount → pay with the sandbox buyer.
5. **Return** — PayFast returns you to the course.
   - ✅ URL carries `purchase=return&mp=…` **through the redirect** to the lesson URL.
   - ✅ "Confirming your payment…" banner over the still-locked reader.
   - ✅ Within seconds: content unlocks **in place, no refresh**, banner disappears.
6. **Holder revisit** — reload the step-2 `?buy=1` URL while signed in as the buyer.
   - ✅ Unlocked content, no dialog (marker ignored for holders).

## Edge checks (quick)

7. **Signed-in buyer** — as an existing signed-in account, open the share link → Buy → sails straight through the gate to the open dialog (no sign-in screen).
8. **Cancel path** — start a checkout, cancel on PayFast → back at the course, still locked, **no banner**.
9. **Creation gate** — Allowlisted account sees the "New course" card and can seed; the step-1 account doesn't. Admin portal reads **"Who can create courses"**.
10. **No eviction** — remove a test email from the Allowlist → that account still signs in (loses only course creation).

## Fail-loudly (optional, needs dashboard)

11. In the Convex dashboard, confirm a completed sandbox purchase wrote: `checkoutIntents` row, `payfastEvents` row, `entitlements` row, `ledger` row (`status: "owed"`, 50/50 split) — and that `pendingEntitlements` no longer exists as a table.
