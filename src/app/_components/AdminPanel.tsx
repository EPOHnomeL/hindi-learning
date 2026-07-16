"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { SellerStatus } from "../../../convex/lib";

// The Admin portal (/admin, ADR 0011 + issue 02): the single Admin manages the
// Allowlist — who may create courses (ADR 0021) — without the CLI. Client-guarded by `amIAdmin`
// (UX only; the mutations are the real security boundary). The list is a live
// Convex query, so adds/removes reflect immediately.
export function AdminPanel() {
  const amAdmin = useQuery(api.whitelist.amIAdmin);

  if (amAdmin === undefined) {
    return <div className="grid min-h-dvh place-items-center text-soft">Checking access…</div>;
  }
  if (!amAdmin) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-2xl place-items-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-accent">Not authorised</h1>
          <p className="mt-2 text-sm text-soft">This page is for the workspace admin.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-accent2 underline-offset-2 hover:underline">
            ← Back to your courses
          </Link>
        </div>
      </div>
    );
  }
  return <AllowlistManager />;
}

// Mounted only once the caller is confirmed Admin, so `whitelist.list` (which
// rejects non-admins server-side) is never queried by anyone else.
function AllowlistManager() {
  const rows = useQuery(api.whitelist.list);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Allowlist</h1>
          <p className="mt-0.5 text-sm text-soft">Who can create courses</p>
        </div>
        <Link href="/" className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
          ← Courses
        </Link>
      </header>

      <AddEmailForm />

      {rows === undefined ? (
        <ul className="mt-6 flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-12 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {rows
            .slice()
            .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.email.localeCompare(b.email))
            .map((row) => (
              <EmailRow key={row.email} email={row.email} isAdmin={row.isAdmin} />
            ))}
        </ul>
      )}

      <SellersManager />
      <PayoutsManager />
    </div>
  );
}

// What the operator owes each Seller (.scratch/payfast-payments, ticket 06):
// the `owed` Ledger rows summed per Seller, with the bank details to EFT to.
// "Mark paid" flips the listed sales to `paid` with the typed EFT reference —
// server-enforced Admin-only, never double-counted.
function PayoutsManager() {
  const owed = useQuery(api.ledger.owedPayouts);
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">Payouts</h2>
        <p className="mt-0.5 text-sm text-soft">What you owe each seller, from the sales ledger</p>
      </div>
      {owed === undefined ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : owed.length === 0 ? (
        <p className="text-sm text-soft">Nothing owed — all sales are paid out.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {owed.map((o) => (
            <PayoutRow key={o.email} owed={o} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Rand formatting for ledger amounts (cents → "R 1 234.56").
function formatRand(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PayoutRow({ owed }: { owed: FunctionReturnType<typeof api.ledger.owedPayouts>[number] }) {
  const markPaid = useMutation(api.ledger.markPaid);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <li className="rounded-xl border border-gold/40 bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <b className="block truncate text-sm font-semibold text-ink">{owed.email}</b>
          <span className="text-xs text-soft">
            {owed.payout
              ? `${owed.payout.accountHolder} · ${owed.payout.bank} · ${owed.payout.accountNumber} · branch ${owed.payout.branchCode}`
              : "No bank details on file — ask the seller before paying out"}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-sm font-bold tabular-nums text-gold">
          {formatRand(owed.totalOwed)}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-soft">
        {owed.sales.length} sale{owed.sales.length === 1 ? "" : "s"} ·{" "}
        {owed.sales.map((s) => `${s.lang} ${formatRand(s.sellerShare)}`).join(", ")}
      </p>
      <form
        className="mt-2.5 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(false);
          try {
            await markPaid({ ids: owed.sales.map((s) => s.id), reference });
            setReference("");
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="EFT reference"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-1.5 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !reference.trim()}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Recording…" : "Mark paid"}
        </button>
        {error && <span className="text-xs text-danger">Failed — retry</span>}
      </form>
    </li>
  );
}

// Who may sell (paid marketplace, ADR 0016 / PayFast rail). The Admin grants a
// User the **can-sell** capability here; the Seller then saves their payout bank
// details on their own (the status column reflects how far they've got).
// Revoking stops new pricing but leaves already-sold access intact.
function SellersManager() {
  const sellers = useQuery(api.sellers.listSellers);
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-accent">Sellers</h2>
        <p className="mt-0.5 text-sm text-soft">Who may list paid courses</p>
      </div>

      <GrantSellerForm />

      {sellers === undefined ? (
        <ul className="mt-6 flex flex-col gap-2" aria-busy>
          {[0, 1].map((i) => (
            <li key={i} className="h-12 animate-pulse rounded-xl border border-line bg-card" />
          ))}
        </ul>
      ) : sellers.length === 0 ? (
        <p className="mt-6 text-sm text-soft">No sellers yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {sellers.map((s) => (
            <SellerRow key={s.email} email={s.email} status={s.status} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Grant can-sell to an existing account by email. The mutation refuses an email
// with no account (you grant a User, not an address); the live list re-renders.
function GrantSellerForm() {
  const grant = useMutation(api.sellers.grantCanSell);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const addr = email.trim();
        if (!addr) return;
        setBusy(true);
        setError(null);
        try {
          await grant({ email: addr });
          setEmail("");
        } catch {
          setError("Couldn't grant — the person must have an account first.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Enable selling for</label>
      <p className="text-sm text-soft">They can then set up payouts and price their finished courses.</p>
      <div className="mt-1 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="seller@example.com"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60">
          {busy ? "Granting…" : "Grant"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// One Seller row: email + readiness status + revoke. Revoke stops new pricing
// (server-enforced) but does not touch courses they've already sold.
function SellerRow({
  email,
  status,
}: {
  email: string;
  status: SellerStatus;
}) {
  const revoke = useMutation(api.sellers.revokeCanSell);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const label = status === "ready" ? "Ready" : "No payout details";

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm text-ink">{email}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            status === "ready" ? "bg-accent2/15 text-accent2" : "bg-hi text-soft"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {error && <span className="text-xs text-danger">Failed — retry</span>}
        <button
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              await revoke({ email });
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          aria-label={`Revoke selling for ${email}`}
        >
          {busy ? "Revoking…" : "Revoke"}
        </button>
      </div>
    </li>
  );
}

// Add an email to the Allowlist. The mutation normalises + validates; on success
// the live list above re-renders with the new row, so there's nothing to do here
// but clear the field.
function AddEmailForm() {
  const addEmail = useMutation(api.whitelist.addEmail);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const addr = email.trim();
        if (!addr) return;
        setBusy(true);
        setError(null);
        try {
          await addEmail({ email: addr });
          setEmail("");
        } catch {
          setError("Couldn't add — check it's a valid email address.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Admit an email</label>
      <p className="text-sm text-soft">They can then create courses with their account.</p>
      <div className="mt-1 flex gap-2">
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="name@example.com"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// One Allowlist row. The Admin's own row is marked and has no remove control —
// the non-removable-Admin guard (also enforced server-side in removeEmail).
function EmailRow({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const removeEmail = useMutation(api.whitelist.removeEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm text-ink">{email}</span>
        {isAdmin && (
          <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">Admin</span>
        )}
      </div>
      {isAdmin ? (
        <span className="shrink-0 text-xs text-soft">Can't be removed</span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          {error && <span className="text-xs text-danger">Failed — retry</span>}
          <button
            onClick={async () => {
              setBusy(true);
              setError(false);
              try {
                await removeEmail({ email });
              } catch {
                setError(true);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
            aria-label={`Remove ${email}`}
          >
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      )}
    </li>
  );
}
