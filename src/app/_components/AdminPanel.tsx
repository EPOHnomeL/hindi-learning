"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SellerStatus } from "../../../convex/lib";

// The Admin portal (/admin, ADR 0011 + issue 02, whitelabel issue 19): the
// dashboard is now scope-aware (ADR 0022). A **sys admin** manages the Allowlist,
// Sellers/Payouts, and every tenant via a tab switcher + tenant picker; a
// **tenant admin** is locked to their own tenant's panel (no Allowlist, no
// picker). Client-guarded by `myAdminScope` (UX only; the mutations are the real
// security boundary). Lists are live Convex queries, so edits reflect immediately.
export function AdminPanel() {
  const scope = useQuery(api.whitelist.myAdminScope);

  if (scope === undefined) {
    return <div className="grid min-h-dvh place-items-center text-soft">Checking access…</div>;
  }
  if (scope.role === "none") {
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
  // A tenant admin sees only their own tenant's panel, directly — no tabs, no
  // sidebar picker, no create action (issue 19).
  if (scope.role === "tenant") {
    return (
      <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
        <header className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Tenant</h1>
          <Link href="/" className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
            ← Courses
          </Link>
        </header>
        <TenantDetail slug={scope.tenantSlug!} />
      </div>
    );
  }
  return <SysAdminDashboard />;
}

// The sys-admin dashboard: a tab switcher between the platform Allowlist and the
// per-tenant Tenants panel. Allowlist is the default tab (its historical landing).
function SysAdminDashboard() {
  const [tab, setTab] = useState<"allowlist" | "tenants">("allowlist");
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-8 md:py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-xl border border-line bg-card p-1">
          <TabButton active={tab === "allowlist"} onClick={() => setTab("allowlist")}>
            Allowlist
          </TabButton>
          <TabButton active={tab === "tenants"} onClick={() => setTab("tenants")}>
            Tenants
          </TabButton>
        </div>
        <Link href="/" className="shrink-0 rounded-lg px-2 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent">
          ← Courses
        </Link>
      </header>
      {tab === "allowlist" ? <AllowlistManager /> : <TenantsManager />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-soft hover:bg-hi hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

// The Allowlist tab body (sys-admin only, so `whitelist.list` — which rejects
// non-admins server-side — is never queried by anyone else). Centred at the
// original width inside the wider dashboard shell.
function AllowlistManager() {
  const rows = useQuery(api.whitelist.list);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-accent md:text-3xl">Allowlist</h1>
        <p className="mt-0.5 text-sm text-soft">Who can create courses</p>
      </div>

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

// The Tenants tab (sys admin): a sidebar list of every tenant + a "+ New tenant"
// action on the left, the selected tenant's stacked panel on the right. The list
// is a live `listTenants` query (sys-admin-gated server-side). Selecting a tenant
// — or creating one — opens its panel; nothing is selected on first load.
function TenantsManager() {
  const tenants = useQuery(api.tenants.listTenants);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-4">
        <NewTenantForm onCreated={setSelected} />
        {tenants === undefined ? (
          <ul className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-10 animate-pulse rounded-lg border border-line bg-card" />
            ))}
          </ul>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-soft">No tenants yet — create one above.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tenants.map((t) => (
              <li key={t.slug}>
                <button
                  onClick={() => setSelected(t.slug)}
                  aria-current={selected === t.slug ? "true" : undefined}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected === t.slug ? "bg-hi text-accent" : "text-ink hover:bg-hi"
                  }`}
                >
                  <span className="block truncate font-medium">{t.displayName}</span>
                  <span className="block truncate text-xs text-soft">{t.slug}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {selected === null ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-line py-24 text-sm text-soft">
          Select a tenant to manage its branding, flags, courses, and members.
        </div>
      ) : (
        <TenantDetail slug={selected} onRemoved={() => setSelected(null)} />
      )}
    </div>
  );
}

// Create a tenant: slug + display name → `createTenant` (sys-admin-gated). On
// success the new tenant's panel opens. Slug validity/dupes are enforced
// server-side; the surfaced error is whatever the mutation threw.
function NewTenantForm({ onCreated }: { onCreated: (slug: string) => void }) {
  const create = useMutation(api.tenants.createTenant);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-gold/50 bg-card p-4 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const { slug: created } = await create({ slug, displayName });
          setSlug("");
          setDisplayName("");
          onCreated(created);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't create the tenant.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-accent2">New tenant</label>
      <input
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          setError(null);
        }}
        placeholder="Display name"
        className="min-w-0 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      <input
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setError(null);
        }}
        placeholder="subdomain-slug"
        className="min-w-0 rounded-lg border border-line bg-card px-3 py-2 text-sm lowercase focus:border-gold focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !slug.trim() || !displayName.trim()}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {busy ? "Creating…" : "+ New tenant"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// The selected tenant's panel: the stacked-scroll layout the prototype settled on
// (issue 06 / 19) — Theme, Flags, Courses, Members, Remove tenant as sections on
// one scrolling page, no sub-navigation. This issue builds the shell + section
// scaffolding; tickets 20–22 fill in each section's real content and mutations.
// `displayName` comes from the public `getTheme` read (also serves both admin
// tiers, so a tenant admin needs no extra query).
function TenantDetail({ slug, onRemoved }: { slug: string; onRemoved?: () => void }) {
  const view = useQuery(api.tenants.getTheme, { slug });
  const displayName = view?.displayName ?? slug;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-accent md:text-2xl">{displayName}</h2>
        <p className="mt-0.5 text-sm text-soft">{slug}.my-course.app</p>
      </div>

      <TenantSection title="Theme" hint="Brand palette, logo, and favicon.">
        Coming in the theme editor (ticket 20).
      </TenantSection>
      <TenantSection title="Flags" hint="Which features are on for this tenant.">
        Coming in the flag toggles (ticket 21).
      </TenantSection>
      <TenantSection title="Courses" hint="Which courses belong to this tenant.">
        <TenantCourses slug={slug} />
      </TenantSection>
      <TenantSection title="Members" hint="Who belongs to this tenant, and its admins.">
        <TenantMembers slug={slug} />
      </TenantSection>
      <TenantSection title="Remove tenant" hint="Delete this tenant. Blocked while any course or member still references it.">
        <TenantRemoval slug={slug} displayName={displayName} onRemoved={onRemoved} />
      </TenantSection>
    </div>
  );
}

// One stacked section of the tenant panel: a titled, bordered block. The body is
// placeholder scaffolding until 20–22 land — the headings + scroll structure are
// what issue 19 delivers.
function TenantSection({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-lg font-semibold tracking-tight text-accent">{title}</h3>
      <p className="mt-0.5 text-sm text-soft">{hint}</p>
      <div className="mt-3 rounded-xl border border-dashed border-line bg-card px-4 py-6 text-sm text-soft">
        {children}
      </div>
    </section>
  );
}

// The Courses section (ticket 22): this tenant's assigned courses (each removable
// back to the default site) plus a search-and-add picker over the assignable pool
// (default-only courses). Assigning sets `topics.tenantSlug`; the live
// `courseAssignment` query re-renders both lists on every write. Tenant-centric —
// the same course is managed here, never on CourseSettings.
function TenantCourses({ slug }: { slug: string }) {
  const data = useQuery(api.tenants.courseAssignment, { tenantSlug: slug });
  const assign = useMutation(api.tenants.assignCourse);
  const unassign = useMutation(api.tenants.unassignCourse);

  if (data === undefined) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {[0, 1].map((i) => (
          <li key={i} className="h-10 animate-pulse rounded-lg border border-line bg-card" />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchAddPicker
        placeholder="Search a course by title…"
        empty="No unassigned courses left to add."
        options={data.available.map((c) => ({ id: c.topicId, label: c.title }))}
        onAdd={(topicId) => assign({ tenantSlug: slug, topicId: topicId as Id<"topics"> })}
      />
      {data.assigned.length === 0 ? (
        <p className="text-sm text-soft">No courses assigned yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.assigned.map((c) => (
            <AssignedRow
              key={c.topicId}
              label={c.title}
              onRemove={() => unassign({ tenantSlug: slug, topicId: c.topicId as Id<"topics"> })}
              removeAria={`Unassign ${c.title}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// The Members section (ticket 22): this tenant's Allowlist members (plain members
// removable back to the default site; a tenant admin is badged and only removable
// via the Allowlist, since clearing their slug would promote them to a sys admin)
// plus a search-and-add picker over the assignable pool (unassigned, non-admin
// Allowlist emails). Assigning sets `whitelist.tenantSlug`.
function TenantMembers({ slug }: { slug: string }) {
  const data = useQuery(api.tenants.memberAssignment, { tenantSlug: slug });
  const assign = useMutation(api.tenants.assignMember);
  const unassign = useMutation(api.tenants.unassignMember);

  if (data === undefined) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {[0, 1].map((i) => (
          <li key={i} className="h-10 animate-pulse rounded-lg border border-line bg-card" />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchAddPicker
        placeholder="Search an admitted email…"
        empty="No unassigned emails to add — admit one on the Allowlist first."
        options={data.available.map((m) => ({ id: m.email, label: m.email }))}
        onAdd={(email) => assign({ tenantSlug: slug, email })}
      />
      {data.assigned.length === 0 ? (
        <p className="text-sm text-soft">No members assigned yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.assigned.map((m) => (
            <AssignedRow
              key={m.email}
              label={m.email}
              badge={m.isAdmin ? "Admin" : undefined}
              onRemove={m.isAdmin ? undefined : () => unassign({ tenantSlug: slug, email: m.email })}
              lockedNote={m.isAdmin ? "Remove via Allowlist" : undefined}
              removeAria={`Unassign ${m.email}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// The Remove tenant section (ticket 22): destructive, and **blocked outright**
// (disabled + explanation, not merely a confirm) while any course, member, or
// user account still references the slug — the counts come from
// `tenantReferenceCounts` and `removeTenant` re-checks them server-side. Only an
// empty tenant is removable, behind a plain confirm. No cascade delete (mirrors
// ADR 0011's refuse-to-remove-the-one-Admin guard).
function TenantRemoval({ slug, displayName, onRemoved }: { slug: string; displayName: string; onRemoved?: () => void }) {
  const counts = useQuery(api.tenants.tenantReferenceCounts, { tenantSlug: slug });
  const remove = useMutation(api.tenants.removeTenant);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (counts === undefined) {
    return <div className="h-10 animate-pulse rounded-lg border border-line bg-card" aria-busy />;
  }

  const blockers: string[] = [];
  if (counts.courses > 0) blockers.push(`${counts.courses} course${counts.courses === 1 ? "" : "s"}`);
  if (counts.members > 0) blockers.push(`${counts.members} member${counts.members === 1 ? "" : "s"}`);
  if (counts.users > 0) blockers.push(`${counts.users} user account${counts.users === 1 ? "" : "s"}`);
  const removable = blockers.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {removable ? (
        <p className="text-sm text-soft">This tenant has nothing assigned — it can be removed.</p>
      ) : (
        <p className="text-sm text-soft">
          Still assigned: {blockers.join(", ")}. Clear them above before this tenant can be removed.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!removable || busy}
          onClick={async () => {
            if (!window.confirm(`Remove the “${displayName}” tenant? This can't be undone.`)) return;
            setBusy(true);
            setError(null);
            try {
              await remove({ tenantSlug: slug });
              onRemoved?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't remove the tenant.");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg border border-danger/50 px-3.5 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-danger"
        >
          {busy ? "Removing…" : "Remove tenant"}
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}

// A search-and-add picker shared by the Courses and Members sections: type to
// filter the assignable options by label, click one to add it. Bounded to the
// first handful of matches so a long pool never floods the panel. `onAdd` is the
// assign mutation; the live query re-renders the lists once it resolves.
function SearchAddPicker({
  placeholder,
  empty,
  options,
  onAdd,
}: {
  placeholder: string;
  empty: string;
  options: { id: string; label: string }[];
  onAdd: (id: string) => Promise<unknown>;
}) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, 8);

  return (
    <div className="flex flex-col gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      {options.length === 0 ? (
        <p className="text-xs text-soft">{empty}</p>
      ) : matches.length === 0 ? (
        <p className="text-xs text-soft">No matches.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={async () => {
                  setBusyId(o.id);
                  setError(false);
                  try {
                    await onAdd(o.id);
                    setQuery("");
                  } catch {
                    setError(true);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="rounded-full border border-line bg-card px-3 py-1 text-sm text-ink transition-colors hover:border-accent hover:bg-hi hover:text-accent disabled:opacity-60"
              >
                {busyId === o.id ? "Adding…" : `+ ${o.label}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="text-xs text-danger">Couldn't add — retry.</span>}
    </div>
  );
}

// One assigned-item row: a label, an optional badge (e.g. a tenant admin), and
// either a Remove control or a locked note when the row can't be removed here.
function AssignedRow({
  label,
  badge,
  onRemove,
  lockedNote,
  removeAria,
}: {
  label: string;
  badge?: string;
  onRemove?: () => Promise<unknown>;
  lockedNote?: string;
  removeAria?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm text-ink">{label}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-hi px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">{badge}</span>
        )}
      </div>
      {onRemove ? (
        <div className="flex shrink-0 items-center gap-2">
          {error && <span className="text-xs text-danger">Failed — retry</span>}
          <button
            onClick={async () => {
              setBusy(true);
              setError(false);
              try {
                await onRemove();
              } catch {
                setError(true);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            aria-label={removeAria}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          >
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      ) : (
        <span className="shrink-0 text-xs text-soft">{lockedNote}</span>
      )}
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
