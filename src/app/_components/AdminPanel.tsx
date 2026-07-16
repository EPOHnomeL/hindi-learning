"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

// The Admin portal (/admin, ADR 0011 + issue 02): the single Admin manages the
// Allowlist — who may sign up — without the CLI. Client-guarded by `amIAdmin`
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
          <p className="mt-0.5 text-sm text-soft">Who can sign up for this workspace</p>
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
    </div>
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
      <p className="text-sm text-soft">They can then create an account. Share the sign-up link with them yourself.</p>
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
