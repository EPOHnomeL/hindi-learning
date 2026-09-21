"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SellerStatus } from "../../../convex/sellerStatus";
import type { TenantFlag } from "../../../convex/tenantFlags";
import { formatMoney } from "~/lib/money";
import { coerceImportedTheme, tenantRemovalBlockers, timeAgo, type Palette } from "./adminDerive";
import {
  AdminShell,
  Amount,
  Badge,
  Cell,
  DataTable,
  EmptyLine,
  ListSkeleton,
  Meter,
  PageHeader,
  Panel,
  Segmented,
  StatTile,
  btnDanger,
  btnGhost,
  btnPrimary,
  inputCls,
  labelCls,
  type AdminTab,
} from "./adminUi";
import { DayStackChart, VizLegend } from "./dayStackChart";
import { Icon } from "./icons";
import { TENANT_THEME_TOKENS, type Token } from "../../design/tokens";
import { salesRange, type SalesPreset } from "./salesRange";
import { colorVar, rankLanguages, VIZ_SLOTS } from "./salesChart";
import { refusalMessage, useMutationRun } from "./mutationRun";

// `mutationError` lived here and recorded the first of the production incidents
// that taught this codebase how a Convex refusal reaches the client. It is
// `refusalMessage` in `./mutationRun` since 2026-09-08 (ticket 32), along with
// the three other copies of it.

// The Admin portal (/admin, ADR 0011 + issue 02, whitelabel issue 19): the
// dashboard is scope-aware (ADR 0022). A **sys admin** manages the Allowlist,
// Sellers/Payouts, and every tenant via a tab strip + tenant picker; a
// **tenant admin** is locked to their own tenant's panel (no tabs, no picker).
// Client-guarded by `myAdminScope` (UX only; the mutations are the real security
// boundary). Lists are live Convex queries, so edits reflect immediately.
//
// Revamped 2026-09-21: the tabs moved into a shell (`adminUi.tsx`), every list
// that is a list of records became a table, and each tab opens on a row of stat
// tiles so the operator reads the state of things before the rows. The
// mutations and the queries are the ones that were here before; this changed
// how they are drawn, not what they do.
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
          <Link href="/" className={`press mt-5 ${btnGhost}`}>
            <Icon name="arrow" className="h-4 w-4 rotate-180" />
            Back to your courses
          </Link>
        </div>
      </div>
    );
  }
  // A tenant admin sees only their own tenant's panel, directly, in the same
  // shell minus the tab strip (issue 19).
  if (scope.role === "tenant") {
    return (
      <AdminShell eyebrow="Tenant admin" title="Your tenant">
        <TenantDetail slug={scope.tenantSlug!} role="tenant" />
      </AdminShell>
    );
  }
  return <SysAdminDashboard />;
}

type SysTab = "payouts" | "sales" | "allowlist" | "tenants" | "generation";

// The sys-admin dashboard. Payouts is the default tab (2026-08-25): it is the one
// screen with money waiting on an action, so it is what the admin opens for, and
// it is first in the strip for the same reason. Its badge is the number of rows
// waiting on the operator, so the count is readable from any other tab.
function SysAdminDashboard() {
  const [tab, setTab] = useState<SysTab>("payouts");
  const queues = useMoneyQueues();
  const waiting =
    queues.owed && queues.eft && queues.batches && queues.codes
      ? queues.owed.length + queues.eft.length + queues.batches.length + queues.codes.filter((c) => c.stoppedAt !== null).length
      : undefined;
  const tabs: readonly AdminTab<SysTab>[] = [
    { key: "payouts", label: "Payouts", icon: "tag", badge: waiting },
    { key: "sales", label: "Sales", icon: "chart" },
    { key: "allowlist", label: "Access", icon: "users" },
    { key: "tenants", label: "Tenants", icon: "globe" },
    { key: "generation", label: "Generation", icon: "refresh" },
  ];
  return (
    <AdminShell eyebrow="Platform admin" title="Admin console" tabs={tabs} active={tab} onTab={setTab}>
      {tab === "payouts" ? (
        <PayoutsManager />
      ) : tab === "sales" ? (
        <SalesManager />
      ) : tab === "allowlist" ? (
        <AllowlistManager />
      ) : tab === "tenants" ? (
        <TenantsManager />
      ) : (
        <GenerationManager />
      )}
    </AdminShell>
  );
}

// Ledger amounts, in the shared spelling. The hardcoded `R ` prefix is gone:
// every row in this panel is Rand today, but the currency beats a prefix that is
// right by coincidence. `en-ZA` stays explicit, because a cash log the operator
// reconciles against a bank statement must not change shape with the browser's
// locale.
function formatRand(cents: number): string {
  return formatMoney(cents, "ZAR", { locale: "en-ZA" });
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// =============================================================================
// Payouts
// =============================================================================

// The four money queues the Payouts tab is made of, read once and shared between
// the tab's tiles, its tables and the tab-strip badge. `useQuery` here is the
// cached flavour, so the shell and the tab subscribing to the same four reads
// costs one subscription each, not two.
function useMoneyQueues() {
  return {
    owed: useQuery(api.ledger.owedPayouts),
    eft: useQuery(api.eft.pendingEftIntents),
    batches: useQuery(api.vouchers.pendingBatches),
    codes: useQuery(api.accessCodes.pendingAccessCodes),
  };
}

type Owed = FunctionReturnType<typeof api.ledger.owedPayouts>[number];
type EftIntent = FunctionReturnType<typeof api.eft.pendingEftIntents>[number];
type Batch = FunctionReturnType<typeof api.vouchers.pendingBatches>[number];
type AccessCode = FunctionReturnType<typeof api.accessCodes.pendingAccessCodes>[number];

// What the operator owes each Seller (.scratch/payfast-payments, ticket 06) and
// the money still to be matched on a bank statement (EFT intents, voucher
// batches, stopped Organisation Vouchers). The three queues sit together
// deliberately: to the operator they are the same job, and a queue that looks
// like a stranger is a queue that gets missed. The collection account closes the
// tab because it is the mirror of everything above it: money coming IN.
function PayoutsManager() {
  const { owed, eft, batches, codes } = useMoneyQueues();
  const sum = <T,>(rows: T[] | undefined, pick: (r: T) => number) =>
    rows === undefined ? undefined : rows.reduce((s, r) => s + pick(r), 0);
  const owedTotal = sum(owed, (o) => o.totalOwed);
  const eftTotal = sum(eft, (e) => e.amount);
  const batchTotal = sum(batches, (b) => b.total);
  const running = codes?.filter((c) => c.stoppedAt === null);
  const ready = codes?.filter((c) => c.stoppedAt !== null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Payouts"
        hint="What you owe each payee from course sales and donations, and the transfers still to match against your bank statement."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Owed to payees"
          icon="tag"
          tone="gold"
          value={owedTotal === undefined ? undefined : formatRand(owedTotal)}
          hint={owed && (owed.length === 0 ? "Everyone is paid out" : `across ${plural(owed.length, "payee")}`)}
        />
        <StatTile
          label="Awaiting EFT"
          icon="check"
          tone="accent2"
          value={eftTotal === undefined ? undefined : formatRand(eftTotal)}
          hint={eft && (eft.length === 0 ? "No transfers to confirm" : `${plural(eft.length, "transfer")} to confirm`)}
        />
        <StatTile
          label="Voucher batches"
          icon="qr"
          value={batchTotal === undefined ? undefined : formatRand(batchTotal)}
          hint={batches && (batches.length === 0 ? "Nothing unpaid" : `${plural(batches.length, "batch", "batches")} unpaid`)}
        />
        <StatTile
          label="Organisation vouchers"
          icon="users"
          value={ready === undefined ? undefined : `${ready.length} to invoice`}
          hint={running && `${plural(running.length, "deal")} still running`}
        />
      </div>

      <Panel
        title="Owed payouts"
        hint="Each payee's share of what sold, with the account to pay it to. Mark paid records the EFT reference against every listed item."
        tone={owed && owed.length > 0 ? "gold" : "line"}
        flush
      >
        <DataTable<Owed>
          rows={owed}
          rowKey={(o) => o.email}
          empty="Nothing owed. Every sale is paid out."
          columns={[
            {
              key: "payee",
              header: "Payee",
              cell: (o) => (
                <Cell
                  primary={o.email}
                  secondary={
                    o.payout
                      ? `${o.payout.accountHolder} · ${o.payout.bank} · ${o.payout.accountNumber} · branch ${o.payout.branchCode}`
                      : "No bank details on file. Ask the seller before paying out."
                  }
                />
              ),
            },
            {
              key: "items",
              header: "Items",
              cell: (o) => (
                <div className="flex flex-wrap gap-1">
                  {/* A donation has no Edition, so the query hands back a null
                      `lang` and the kind to label it with (ADR 0027). A voucher
                      batch DOES have an Edition, so it needs the kind too or it
                      reads as an ordinary sale of that language at a bulk price
                      (ADR 0029). */}
                  {o.sales.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-md bg-hi px-1.5 py-0.5 text-[11px] text-ink"
                    >
                      <span className="font-semibold uppercase tracking-wide text-soft">
                        {s.kind === "donation" ? "donation" : s.kind === "batch" ? `${s.lang} batch` : s.lang}
                      </span>
                      <span className="tabular-nums">{formatRand(s.sellerShare)}</span>
                    </span>
                  ))}
                </div>
              ),
            },
            {
              key: "owed",
              header: "Owed",
              align: "end",
              cell: (o) => <Amount tone="gold">{formatRand(o.totalOwed)}</Amount>,
            },
            {
              key: "pay",
              header: "Mark paid",
              className: "w-[22rem]",
              cell: (o) => <MarkPaidForm owed={o} />,
            },
          ]}
        />
      </Panel>

      {(eft === undefined || eft.length > 0) && <EftQueue pending={eft} />}
      {(batches === undefined || batches.length > 0) && <BatchQueue pending={batches} />}
      {(codes === undefined || codes.length > 0) && <AccessCodeQueue pending={codes} />}

      <OperatorBankForm />
    </div>
  );
}

// "Mark paid" flips the listed sales to `paid` with the typed EFT reference,
// server-enforced Admin-only, never double-counted.
function MarkPaidForm({ owed }: { owed: Owed }) {
  const markPaid = useMutation(api.ledger.markPaid);
  return (
    <ReferenceForm
      placeholder="EFT reference"
      label="Mark paid"
      busyLabel="Recording…"
      onSubmit={(reference) => markPaid({ ids: owed.sales.map((s) => s.id), reference })}
    />
  );
}

// The one inline "type a reference, press the button" form the three money
// queues and the owed table share. The field clears on success and stays put on
// a refusal, so the operator can see what was rejected.
function ReferenceForm({
  placeholder,
  label,
  busyLabel,
  onSubmit,
}: {
  placeholder: string;
  label: string;
  busyLabel: string;
  onSubmit: (reference: string) => Promise<unknown>;
}) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex min-w-[16rem] flex-col gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reference.trim()) return;
        setBusy(true);
        setError(null);
        try {
          await onSubmit(reference);
          setReference("");
        } catch (err) {
          setError(refusalMessage(err, "Failed. Retry."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex gap-1.5">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} flex-1 py-1.5`}
        />
        <button type="submit" disabled={busy || !reference.trim()} className={`${btnPrimary} py-1.5`}>
          {busy ? busyLabel : label}
        </button>
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </form>
  );
}

// The pending bank transfers (manual EFT rail, ywampotch-launch ticket 04): the
// operator reads their bank statement, finds the reference, and clicks. Confirm
// mints the Entitlement AND the Ledger row in one server transaction, so the sale
// lands in Sales and as `owed` above like any card sale. Dismiss is for a transfer
// that never came: stale intents are litter, not errors, and a queue that silts
// up stops being read, which is how a real payment eventually gets missed.
function EftQueue({ pending }: { pending: EftIntent[] | undefined }) {
  return (
    <Panel title="Awaiting EFT" hint="Match the reference on your bank statement, then confirm. Confirming grants the buyer access." tone="gold" flush>
      <DataTable<EftIntent>
        rows={pending}
        rowKey={(p) => p.ref}
        empty="No transfers waiting."
        columns={[
          { key: "ref", header: "Reference", cell: (p) => <Cell mono primary={p.ref} /> },
          { key: "buyer", header: "Buyer", cell: (p) => <Cell primary={p.email} /> },
          { key: "course", header: "Course", cell: (p) => <CourseCell title={p.courseTitle} lang={p.lang} /> },
          { key: "amount", header: "Amount", align: "end", cell: (p) => <Amount tone="gold">{formatRand(p.amount)}</Amount> },
          { key: "actions", header: "", align: "end", cell: (p) => <EftActions intent={p} /> },
        ]}
      />
    </Panel>
  );
}

function EftActions({ intent }: { intent: EftIntent }) {
  const confirm = useMutation(api.eft.confirmEftPayment);
  const dismiss = useMutation(api.eft.dismissEftIntent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Confirming grants paid access and writes money. A misread statement line is
  // not a thing to undo, so the destructive-ish half asks once.
  const run = async (action: (args: { ref: string }) => Promise<null>) => {
    setBusy(true);
    setError(false);
    try {
      await action({ ref: intent.ref });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center justify-end gap-1.5">
      {error && <span className="text-xs text-danger">Failed. Retry.</span>}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (confirm_(`Confirm ${formatRand(intent.amount)} received for ${intent.ref}? This grants access.`)) {
            void run(confirm);
          }
        }}
        className={`${btnPrimary} py-1.5`}
      >
        {busy ? "Working…" : "Confirm"}
      </button>
      <button type="button" disabled={busy} onClick={() => void run(dismiss)} className={`${btnGhost} py-1.5 hover:border-danger hover:bg-card hover:text-danger`}>
        Dismiss
      </button>
    </div>
  );
}

// The voucher batches whose transfer has not been logged yet (vouchers ticket 04,
// ADR 0029). Two things this is NOT. It is not an approval: the batch's codes
// have been working since the Seller minted them, so logging the reference
// changes nothing for the organisation and only makes the Seller's 50% payable.
// And it never shows a code: `pendingBatches` cannot return one, so the boundary
// between the money role and the selling role is server-side, not this
// component's restraint.
function BatchQueue({ pending }: { pending: Batch[] | undefined }) {
  return (
    <Panel
      title="Bulk vouchers awaiting payment"
      hint="Check the total against what landed, then log the reference. That makes the seller's share payable."
      tone="gold"
      flush
    >
      <DataTable<Batch>
        rows={pending}
        rowKey={(b) => b.batchId}
        empty="No batches waiting."
        columns={[
          { key: "org", header: "Organisation", cell: (b) => <Cell primary={b.orgName} secondary={b.orgContact} /> },
          { key: "course", header: "Course", cell: (b) => <CourseCell title={b.courseTitle} lang={b.lang} seller={b.sellerEmail} /> },
          {
            key: "takeup",
            header: "Take-up",
            // Take-up beside the size, because "0 of 200 redeemed" after a month
            // is a distribution problem to raise with the Seller and "195 of 200"
            // is a payment to chase. A NUMBER only: a redemption records nothing
            // about who (ADR 0029).
            cell: (b) => <Meter fraction={b.seats ? b.redeemed / b.seats : 0} label={`${b.redeemed} of ${b.seats} seats`} />,
          },
          {
            key: "total",
            header: "Total",
            align: "end",
            cell: (b) => (
              <div className="flex items-center justify-end gap-2">
                {/* Voided batches stay on this queue: voiding stops codes, never
                    money, so cash for a collapsed deal can still land and still
                    has to be matched. */}
                {b.voided && <Badge tone="danger">Voided</Badge>}
                <Amount tone="gold">{formatRand(b.total)}</Amount>
              </div>
            ),
          },
          { key: "log", header: "Log payment", className: "w-[22rem]", cell: (b) => <LogBatchForm batch={b} /> },
        ]}
      />
    </Panel>
  );
}

function LogBatchForm({ batch }: { batch: Batch }) {
  const log = useMutation(api.vouchers.logBatchPayment);
  return (
    <ReferenceForm
      placeholder="Bank reference / transaction id"
      label="Log"
      busyLabel="Working…"
      onSubmit={(reference) => log({ batchId: batch.batchId, reference })}
    />
  );
}

// The Organisation Vouchers (ADR 0031, shared-access-codes ticket 07): running
// deals and the stopped ones ready to invoice. **The line carries everything
// needed to raise the invoice, because the platform does not raise it.** SARS
// wants seven fields plus a serial and a date within 21 days of supply, so the
// operator raises the invoice in whatever they already use and this is the line
// they read it off: organisation, billing contact, seats, per-seat price, total.
// A live voucher shows no reference box, because there is genuinely nothing to
// log yet. It never shows a code or a nickname: `pendingAccessCodes` cannot
// return either.
function AccessCodeQueue({ pending }: { pending: AccessCode[] | undefined }) {
  return (
    <Panel
      title="Organisation vouchers"
      hint="Running deals and the ones ready to invoice. A stopped voucher takes a reference; a running one owes nothing yet."
      tone="gold"
      flush
    >
      <DataTable<AccessCode>
        rows={pending}
        rowKey={(c) => c.accessCodeId}
        empty="No organisation vouchers."
        columns={[
          { key: "org", header: "Organisation", cell: (c) => <Cell primary={c.orgName} secondary={c.orgContact} /> },
          { key: "course", header: "Course", cell: (c) => <CourseCell title={c.courseTitle} lang={c.lang} seller={c.sellerEmail} /> },
          {
            key: "seats",
            header: "Seats",
            // The arithmetic spelled out rather than just its answer: the
            // operator is about to put these numbers on an invoice.
            cell: (c) => (
              <span className="tabular-nums text-ink">
                {c.seats} × {formatRand(c.pricePerSeat)}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (c) => (c.stoppedAt === null ? <Badge tone="soft">Running</Badge> : <Badge tone="gold">Ready to invoice</Badge>),
          },
          // Running vs ready-to-invoice, because the total means different
          // things: on a live voucher it is what the deal has run up SO FAR, on a
          // stopped one it is final and invoiceable.
          { key: "total", header: "Total", align: "end", cell: (c) => <Amount tone="gold">{formatRand(c.total)}</Amount> },
          {
            key: "log",
            header: "Log payment",
            className: "w-[22rem]",
            cell: (c) =>
              c.stoppedAt === null ? (
                <span className="text-xs text-soft">Nothing due yet. The seller stops it when the agreement ends.</span>
              ) : (
                <LogAccessCodeForm code={c} />
              ),
          },
        ]}
      />
    </Panel>
  );
}

function LogAccessCodeForm({ code }: { code: AccessCode }) {
  const log = useMutation(api.accessCodes.logAccessCodePayment);
  return (
    <ReferenceForm
      placeholder="Bank reference / transaction id"
      label="Log"
      busyLabel="Working…"
      onSubmit={(reference) => log({ accessCodeId: code.accessCodeId, reference })}
    />
  );
}

// A course title with its language badge, and the seller beneath when the row
// has one.
function CourseCell({ title, lang, seller }: { title: string; lang: string; seller?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-medium text-ink">{title}</span>
        <Badge tone="soft">{lang}</Badge>
      </div>
      {seller && <div className="mt-0.5 truncate text-xs text-soft">{seller}</div>}
    </div>
  );
}

// ponytail: the browser's own confirm dialog for the one irreversible click, not a
// modal component. Wrapped so the lint rule about bare `confirm` has one site.
function confirm_(message: string): boolean {
  return window.confirm(message);
}

// The operator's **collection** account (manual EFT rail, ywampotch-launch ticket
// 02): where buyers EFT the purchase price IN. Editable here so the operator can
// correct it on prod without a deploy; sys-admin-only server-side
// (`eft.saveOperatorBank`), so a tenant admin can never move where the platform's
// money is collected. The `enabled` toggle IS the rail's on/off switch: off, and
// no buyer is offered "Pay by EFT".
function OperatorBankForm() {
  const saved = useQuery(api.eft.operatorBank);
  const save = useMutation(api.eft.saveOperatorBank);
  const [form, setForm] = useState<{
    accountHolder: string;
    bank: string;
    accountNumber: string;
    branchCode: string;
    enabled: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Seed the form from the saved record once it arrives (and never again, so
  // typing isn't clobbered by the live query re-firing after a save).
  const blank = { accountHolder: "", bank: "", accountNumber: "", branchCode: "", enabled: false };
  const values = form ?? (saved === undefined ? null : (saved ?? blank));
  const set = (patch: Partial<NonNullable<typeof values>>) => {
    setForm({ ...(values ?? blank), ...patch });
    setError(null);
    setDone(false);
  };

  return (
    <Panel
      title="EFT collection account"
      hint="Where buyers pay you directly, instead of by card."
      actions={
        values && (
          <Badge tone={values.enabled ? "accent2" : "soft"}>{values.enabled ? "Offered to buyers" : "Switched off"}</Badge>
        )
      }
    >
      {values === null ? (
        <div className="h-40 animate-pulse rounded-xl bg-soft/10" aria-busy />
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await save(values);
              setDone(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't save those details.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["accountHolder", "Account name", "YWAM Potch"],
                ["bank", "Bank", "FNB"],
                ["accountNumber", "Account number", "62000000001"],
                ["branchCode", "Branch code", "250655"],
              ] as const
            ).map(([field, label, placeholder]) => (
              <label key={field} className="flex flex-col gap-1">
                <span className={labelCls}>{label}</span>
                <input value={values[field]} onChange={(e) => set({ [field]: e.target.value })} placeholder={placeholder} className={inputCls} />
              </label>
            ))}
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-ink">Offer &ldquo;Pay by EFT&rdquo; to buyers</span>
              <span className="block text-xs text-soft">Off, and no buyer sees the bank transfer option at checkout.</span>
            </span>
            <Switch checked={values.enabled} onChange={(on) => set({ enabled: on })} label="Offer Pay by EFT to buyers" />
          </label>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? "Saving…" : "Save"}
            </button>
            {error && <span className="text-xs text-danger">{error}</span>}
            {done && !error && <span className="text-xs text-accent2">Saved.</span>}
          </div>
        </form>
      )}
    </Panel>
  );
}

// The one toggle switch, shared by the collection account and the tenant flags.
function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <span className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] motion-reduce:after:transition-none peer-checked:bg-accent2 peer-checked:after:translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-disabled:opacity-60" />
    </span>
  );
}

// =============================================================================
// Sales
// =============================================================================

// The Sales tab (.scratch/admin-sales): which courses and which editions sold how
// much over a chosen period. The period is chosen with quick presets or a custom
// date range, both feeding `sales.report` as ms bounds. Sys-admin gated
// server-side, so the query is never answered for anyone else.
const SALES_PRESETS: { key: SalesPreset; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

type SalesCourse = FunctionReturnType<typeof api.sales.report>[number];

function SalesManager() {
  const [preset, setPreset] = useState<SalesPreset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  // `salesRange` floors `now` to the day, so these args are stable across
  // renders. A raw `Date.now()` here would make useQuery loop forever.
  const range = salesRange(preset, from, to, Date.now());
  const report = useQuery(api.sales.report, range);
  const totalGross = report?.reduce((sum, c) => sum + c.gross, 0);
  const totalCount = report?.reduce((sum, c) => sum + c.count, 0);
  const ranked = report ? rankLanguages(report) : [];
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Sales"
        hint="What each course and edition sold in a period."
        actions={<Segmented label="Period" options={SALES_PRESETS} value={preset} onChange={setPreset} />}
      />
      {preset === "custom" && (
        <div className="-mt-4 flex flex-wrap items-center gap-3 text-sm text-soft">
          <label className="flex items-center gap-2">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} py-1.5`} />
          </label>
          <label className="flex items-center gap-2">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} py-1.5`} />
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Gross" icon="tag" tone="gold" value={totalGross === undefined ? undefined : formatRand(totalGross)} />
        <StatTile label="Sales" icon="chart" tone="accent2" value={totalCount === undefined ? undefined : String(totalCount)} />
        <StatTile
          label="Courses sold"
          icon="book"
          value={report === undefined ? undefined : String(report.length)}
          hint={report && `${plural(ranked.length, "language")}`}
        />
        <StatTile
          label="Average sale"
          icon="check"
          value={totalGross === undefined || totalCount === undefined ? undefined : totalCount === 0 ? "None" : formatRand(Math.round(totalGross / totalCount))}
        />
      </div>

      <Panel title="Sales by day" hint="One column per day, stacked by edition language. A language keeps its colour in the table below.">
        <SalesDayChart range={range} ranked={ranked} />
      </Panel>

      <Panel title="By course" hint="Open a course for its per-edition breakdown." flush>
        <DataTable<SalesCourse>
          rows={report}
          rowKey={(c) => c.topicId}
          empty="No sales in this period."
          expanded={(c) =>
            open.has(c.topicId) ? (
              <ul className="flex flex-col divide-y divide-line/60">
                {c.editions.map((e) => (
                  <li key={e.lang} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colorVar(e.lang, ranked) }} aria-hidden />
                      <span className="truncate text-ink">{e.title}</span>
                      <Badge tone="soft">{e.lang}</Badge>
                    </span>
                    <span className="flex shrink-0 items-center gap-4 tabular-nums">
                      <span className="text-soft">{plural(e.count, "sale")}</span>
                      <span className="w-24 text-end font-medium text-ink">{formatRand(e.gross)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null
          }
          columns={[
            {
              key: "course",
              header: "Course",
              cell: (c) => (
                <button type="button" onClick={() => toggle(c.topicId)} aria-expanded={open.has(c.topicId)} className="flex min-w-0 items-center gap-2 text-start">
                  <Icon name="chevron" className={`h-4 w-4 shrink-0 text-soft transition-transform motion-reduce:transition-none ${open.has(c.topicId) ? "" : "-rotate-90"}`} />
                  <span className="truncate font-medium text-ink">{c.courseTitle}</span>
                </button>
              ),
            },
            {
              key: "editions",
              header: "Editions",
              cell: (c) => (
                <div className="flex flex-wrap gap-1">
                  {c.editions.map((e) => (
                    <span key={e.lang} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-soft">
                      <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: colorVar(e.lang, ranked) }} aria-hidden />
                      {e.lang}
                    </span>
                  ))}
                </div>
              ),
            },
            { key: "count", header: "Sales", align: "end", cell: (c) => <span className="tabular-nums text-ink">{c.count}</span> },
            {
              key: "share",
              header: "Share",
              cell: (c) => <Meter fraction={totalGross ? c.gross / totalGross : 0} label={totalGross ? `${Math.round((c.gross / totalGross) * 100)}%` : undefined} />,
            },
            { key: "gross", header: "Gross", align: "end", cell: (c) => <Amount>{formatRand(c.gross)}</Amount> },
          ]}
        />
      </Panel>
    </div>
  );
}

// The sales-by-day chart (dataviz skill): one column per day of the chosen
// period, height = that day's sale count on one shared axis, stacked into
// per-edition segments coloured by language. The language to colour mapping
// comes from the whole period's ranking (`rankLanguages`), so a language keeps
// its colour on every day and in the table below.
function SalesDayChart({ range, ranked }: { range: { from?: number; to?: number }; ranked: readonly string[] }) {
  const days = useQuery(api.sales.byDay, range);
  const order = (lang: string) => {
    const i = ranked.indexOf(lang);
    return i < 0 ? ranked.length : i;
  };
  return (
    <figure className="viz-chart">
      <figcaption className="mb-4 flex justify-end">
        <VizLegend series={ranked.slice(0, VIZ_SLOTS).map((lang) => ({ key: lang, label: lang.toUpperCase(), color: colorVar(lang, ranked) }))} />
      </figcaption>
      {days === undefined ? (
        <div className="h-40 animate-pulse rounded-lg bg-soft/10" aria-busy />
      ) : (
        <DayStackChart
          columns={days.map((d) => ({
            dayMs: d.dayMs,
            // Sorted by the period-wide rank, top seller on the baseline, so the
            // stack order is identical on every column.
            segments: [...d.editions]
              .sort((a, b) => order(a.lang) - order(b.lang))
              .map((e) => ({ key: e.lang, label: `${e.lang.toUpperCase()} · ${formatRand(e.gross)}`, value: e.count, color: colorVar(e.lang, ranked) })),
          }))}
          empty="No sales in this period."
          zero="No sales"
        />
      )}
    </figure>
  );
}

// =============================================================================
// Access (Allowlist + Sellers)
// =============================================================================

type AllowRow = FunctionReturnType<typeof api.whitelist.list>[number];
type Seller = FunctionReturnType<typeof api.sellers.listSellers>[number];

// The Access tab (sys-admin only, so `whitelist.list`, which rejects non-admins
// server-side, is never queried by anyone else): who may create courses, and
// who may sell them.
function AllowlistManager() {
  const rows = useQuery(api.whitelist.list);
  const sellers = useQuery(api.sellers.listSellers);
  const sorted = rows?.slice().sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.email.localeCompare(b.email));
  const ready = sellers?.filter((s) => s.status === "ready").length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Access" hint="Who is admitted to create courses, and which of them may list paid ones." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Admitted" icon="users" value={rows && String(rows.length)} hint={rows && `${plural(rows.filter((r) => r.isAdmin).length, "admin")}`} />
        <StatTile label="Sellers" icon="tag" tone="gold" value={sellers && String(sellers.length)} hint={sellers && ready !== undefined ? `${ready} ready to sell` : undefined} />
        <StatTile
          label="Missing payout details"
          icon="lock"
          tone={sellers && sellers.length - (ready ?? 0) > 0 ? "danger" : "soft"}
          value={sellers && ready !== undefined ? String(sellers.length - ready) : undefined}
        />
      </div>

      <Panel title="Allowlist" hint="They can create courses with their account. The admin row cannot be removed." actions={<AddEmailForm />} flush>
        <DataTable<AllowRow>
          rows={sorted}
          rowKey={(r) => r.email}
          empty="Nobody admitted yet."
          columns={[
            { key: "email", header: "Email", cell: (r) => <Cell primary={r.email} /> },
            { key: "role", header: "Role", cell: (r) => (r.isAdmin ? <Badge tone="accent">Admin</Badge> : <span className="text-xs text-soft">Member</span>) },
            {
              key: "actions",
              header: "",
              align: "end",
              cell: (r) => (r.isAdmin ? <span className="text-xs text-soft">Can't be removed</span> : <RemoveEmailButton email={r.email} />),
            },
          ]}
        />
      </Panel>

      {/* Who may sell (paid marketplace, ADR 0016 / PayFast rail). The Admin
          grants a User the **can-sell** capability here; the Seller then saves
          their payout bank details on their own (the status column reflects how
          far they've got). Revoking stops new pricing but leaves already-sold
          access intact. */}
      <Panel title="Sellers" hint="Who may list paid courses. They set up payouts and price their finished courses themselves." actions={<GrantSellerForm />} flush>
        <DataTable<Seller>
          rows={sellers}
          rowKey={(s) => s.email}
          empty="No sellers yet."
          columns={[
            { key: "email", header: "Email", cell: (s) => <Cell primary={s.email} /> },
            {
              key: "status",
              header: "Status",
              cell: (s) => (s.status === "ready" ? <Badge tone="accent2">Ready</Badge> : <Badge tone="soft">No payout details</Badge>),
            },
            {
              key: "payout",
              header: "Payout account",
              cell: (s) => (s.payout ? <Cell primary={s.payout.accountHolder} secondary={`${s.payout.bank} · ${s.payout.accountNumber} · branch ${s.payout.branchCode}`} /> : <span className="text-xs text-soft">Not saved yet</span>),
            },
            { key: "actions", header: "", align: "end", cell: (s) => <RevokeSellerButton email={s.email} status={s.status} /> },
          ]}
        />
      </Panel>
    </div>
  );
}

// Grant can-sell to an existing account by email. The mutation refuses an email
// with no account (you grant a User, not an address); the live list re-renders.
function GrantSellerForm() {
  const grant = useMutation(api.sellers.grantCanSell);
  return (
    <InlineEmailForm
      placeholder="seller@example.com"
      label="Grant selling"
      busyLabel="Granting…"
      failure="Couldn't grant. The person must have an account first."
      onSubmit={(email) => grant({ email })}
    />
  );
}

// One Seller row's revoke. Revoke stops new pricing (server-enforced) but does
// not touch courses they've already sold.
function RevokeSellerButton({ email, status }: { email: string; status: SellerStatus }) {
  const revoke = useMutation(api.sellers.revokeCanSell);
  return <RowActionButton label="Revoke" busyLabel="Revoking…" aria={`Revoke selling for ${email} (${status})`} run={() => revoke({ email })} />;
}

// =============================================================================
// Generation
// =============================================================================

type Run = FunctionReturnType<typeof api.routine.runHistory>[number];
type TokenRow = FunctionReturnType<typeof api.routine.tokenUsageByTopic>[number];

// The Generation tab (generation-observability, issue 04): what the Routine is
// authoring right now over a history of past Generation Runs. All live Convex
// queries (sys-admin-gated server-side), so they update on their own while open.
function GenerationManager() {
  const day = 86_400_000;
  // The 30-day window is floored to the UTC day so the query args stay stable
  // across renders (a raw Date.now() would resubscribe forever, see salesRange).
  const to = Math.floor(Date.now() / day) * day + day; // start of tomorrow, UTC
  const from = to - 30 * day;
  const usage = useQuery(api.routine.usageByDay, { from, to });
  const runs = useQuery(api.routine.runHistory);
  const tokens = useQuery(api.routine.tokenUsageByTopic);

  const generated = usage?.reduce((s, r) => s + r.generation, 0);
  const translated = usage?.reduce((s, r) => s + r.translation, 0);
  const failed = runs?.filter((r) => r.outcome === "failed").length;
  const published = runs?.filter((r) => r.outcome === "published").length;
  const tokenTotal = tokens?.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
  const unmeasured = tokens?.reduce((s, r) => s + r.runsWithoutUsage, 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Generation" hint="What the routine is building, and what it has built." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Generated · 30 days" icon="refresh" tone="accent2" value={generated === undefined ? undefined : String(generated)} hint="lessons authored" />
        <StatTile label="Translated · 30 days" icon="globe" value={translated === undefined ? undefined : String(translated)} hint="edition lessons" />
        <StatTile
          label="Recent runs"
          icon="check"
          tone={failed ? "danger" : "soft"}
          value={runs && String(runs.length)}
          hint={runs && published !== undefined && failed !== undefined ? `${published} published · ${failed} failed` : undefined}
        />
        <StatTile
          label="Tokens reported"
          icon="chart"
          value={tokenTotal === undefined ? undefined : tokenTotal.toLocaleString()}
          hint={unmeasured === undefined ? undefined : unmeasured > 0 ? `${plural(unmeasured, "run")} not measured` : "every run measured"}
        />
      </div>

      {/* Daily generation + translation usage as stacked columns (generation on
          the bottom, translation on top), on one shared count axis. */}
      <Panel title="Activity · last 30 days" hint="Lessons the routine generated and translated, per day.">
        <figure className="viz-chart">
          <figcaption className="mb-4 flex justify-end">
            <VizLegend
              series={[
                { key: "generation", label: "Generation", color: "var(--viz-1)" },
                { key: "translation", label: "Translation", color: "var(--viz-2)" },
              ]}
            />
          </figcaption>
          {usage === undefined ? (
            <div className="h-40 animate-pulse rounded-lg bg-soft/10" aria-busy />
          ) : (
            <DayStackChart
              columns={usage.map((r) => ({
                dayMs: r.dayMs,
                segments: [
                  { key: "generation", label: "Generation", value: r.generation, color: "var(--viz-1)" },
                  { key: "translation", label: "Translation", value: r.translation, color: "var(--viz-2)" },
                ],
              }))}
              empty="No generation or translation in the last 30 days."
              zero="Nothing built"
            />
          )}
        </figure>
      </Panel>

      <GeneratingNow />

      <Panel title="History" hint="Recent runs, newest first." flush>
        <DataTable<Run>
          rows={runs}
          rowKey={(r) => `${r.topicSlug}:${r.startedAt}`}
          empty="No runs recorded yet."
          columns={[
            { key: "course", header: "Course", cell: (r) => <Cell primary={r.topicTitle} secondary={r.owner ? `by ${r.owner}` : undefined} /> },
            {
              key: "outcome",
              header: "Outcome",
              cell: (r) => <Badge tone={OUTCOME_TONE[r.outcome]}>{OUTCOME_LABEL[r.outcome]}</Badge>,
            },
            {
              key: "result",
              header: "Result",
              cell: (r) =>
                r.outcome === "published" && r.producedLessonTitle ? (
                  <span className="text-ink">{r.producedLessonTitle}</span>
                ) : r.outcome === "failed" && r.error ? (
                  <span className="break-words text-xs text-danger">{r.error}</span>
                ) : (
                  <span className="text-xs text-soft">Nothing to do</span>
                ),
            },
            {
              key: "when",
              header: "When",
              align: "end",
              cell: (r) => <span className="text-xs tabular-nums whitespace-nowrap text-soft">{timeAgo(r.endedAt)}</span>,
            },
          ]}
        />
      </Panel>

      {/* Per-Topic token usage (cost instrumentation, technical-foundation/12).
          Deliberately counts with no price and no currency anywhere: this
          measures, it does not bill. "n of m runs not measured" is the point of
          the surface as much as the totals are: a run whose runtime cannot count
          its own tokens is recorded as unknown, so the totals are a floor. */}
      <Panel title="Tokens" hint="Reported usage per course. Runs that cannot report are counted, not guessed." flush>
        <DataTable<TokenRow>
          rows={tokens}
          rowKey={(r) => r.topicSlug}
          empty="No runs recorded yet."
          columns={[
            { key: "course", header: "Course", cell: (r) => <Cell primary={r.topicTitle} secondary={r.models.length > 0 ? r.models.join(", ") : undefined} /> },
            {
              key: "runs",
              header: "Runs",
              cell: (r) => (
                <span className="text-xs text-soft">
                  {r.runsWithoutUsage > 0 ? `${r.runsWithoutUsage} of ${r.runs} not measured` : `${plural(r.runs, "run")} measured`}
                </span>
              ),
            },
            { key: "in", header: "Input", align: "end", cell: (r) => <span className="tabular-nums text-ink">{r.inputTokens.toLocaleString()}</span> },
            { key: "out", header: "Output", align: "end", cell: (r) => <span className="tabular-nums text-ink">{r.outputTokens.toLocaleString()}</span> },
          ]}
        />
      </Panel>
    </div>
  );
}

const OUTCOME_LABEL: Record<Run["outcome"], string> = { published: "Published", nothing: "Caught up", failed: "Failed" };
const OUTCOME_TONE: Record<Run["outcome"], "accent2" | "soft" | "danger"> = { published: "accent2", nothing: "soft", failed: "danger" };

// The live "what's busy now" section, reading the generation lock via generatingNow.
function GeneratingNow() {
  const rows = useQuery(api.routine.generatingNow);
  return (
    <Panel title="Generating now" hint="Courses the routine is authoring this moment." actions={rows && rows.length > 0 ? <Badge tone="accent2">{plural(rows.length, "run")} live</Badge> : undefined}>
      {rows === undefined ? (
        <ListSkeleton rows={1} height="h-12" />
      ) : rows.length === 0 ? (
        <EmptyLine>Nothing generating right now.</EmptyLine>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.topicSlug} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent2/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent2" />
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-ink">
                  {r.topicTitle}
                  {r.owner && <span className="ml-2 font-normal text-soft">· {r.owner}</span>}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.stale && <Badge tone="soft">Stale · will retry</Badge>}
                {r.startedAt !== null && <span className="text-xs tabular-nums text-soft">{timeAgo(r.startedAt)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// =============================================================================
// Tenants
// =============================================================================

// The Tenants tab (sys admin): a picker of every tenant plus a "New tenant" form
// on the left, the selected tenant's stacked panel on the right. The list is a
// live `listTenants` query (sys-admin-gated server-side). Selecting a tenant, or
// creating one, opens its panel; nothing is selected on first load.
function TenantsManager() {
  const tenants = useQuery(api.tenants.listTenants);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tenants" hint="Each whitelabel subdomain: its brand, its feature flags, its courses and its members." />
      <div className="grid gap-6 md:grid-cols-[17rem_1fr] md:items-start">
        <aside className="flex flex-col gap-4 md:sticky md:top-6">
          <Panel title="All tenants" hint={tenants && plural(tenants.length, "tenant")} flush>
            {tenants === undefined ? (
              <div className="p-3">
                <ListSkeleton rows={3} height="h-11" />
              </div>
            ) : tenants.length === 0 ? (
              <EmptyLine>No tenants yet. Create one below.</EmptyLine>
            ) : (
              <ul className="flex flex-col p-1.5">
                {tenants.map((t) => {
                  const on = selected === t.slug;
                  return (
                    <li key={t.slug}>
                      <button
                        onClick={() => setSelected(t.slug)}
                        aria-current={on ? "true" : undefined}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm transition-colors ${
                          on ? "bg-hi text-accent" : "text-ink hover:bg-hi/60"
                        }`}
                      >
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold uppercase ${on ? "bg-accent text-white" : "bg-paper text-soft"}`}>
                          {t.displayName.slice(0, 1)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{t.displayName}</span>
                          <span className="block truncate text-xs text-soft">{t.slug}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <NewTenantForm onCreated={setSelected} />
        </aside>

        {selected === null ? (
          <div className="grid min-h-[20rem] place-items-center rounded-2xl border border-dashed border-line text-center text-sm text-soft">
            <div className="flex flex-col items-center gap-2 px-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-hi text-soft">
                <Icon name="globe" className="h-5 w-5" />
              </span>
              Select a tenant to manage its branding, flags, courses, and members.
            </div>
          </div>
        ) : (
          <TenantDetail slug={selected} role="sys" onRemoved={() => setSelected(null)} />
        )}
      </div>
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
    <Panel title="New tenant" hint="A display name and the subdomain it lives at.">
      <form
        className="flex flex-col gap-2"
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
        <input
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setError(null);
          }}
          placeholder="Display name"
          className={inputCls}
        />
        <input
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setError(null);
          }}
          placeholder="subdomain-slug"
          className={`${inputCls} lowercase`}
        />
        <button type="submit" disabled={busy || !slug.trim() || !displayName.trim()} className={btnPrimary}>
          <Icon name="plus" className="h-4 w-4" />
          {busy ? "Creating…" : "New tenant"}
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </form>
    </Panel>
  );
}

// The selected tenant's panel: the stacked-scroll layout the prototype settled on
// (issue 06 / 19): Theme, Flags, Donations, Courses, Members, Remove tenant as
// panels on one scrolling page, no sub-navigation. `displayName` comes from the
// public `getTheme` read (also serves both admin tiers, so a tenant admin needs
// no extra query).
//
// `role` is which tier is looking. A tenant admin manages what the sys admin
// allocated to them, so they get Theme (their brand) and Courses read-only (what
// they were given); Flags, Donations, Members, and Remove tenant are the
// allocator's and aren't rendered for them. The mutations behind each are
// sys-admin-only server-side; this only stops drawing controls that would refuse.
function TenantDetail({ slug, role, onRemoved }: { slug: string; role: "sys" | "tenant"; onRemoved?: () => void }) {
  const view = useQuery(api.tenantTheme.getTheme, { slug });
  const displayName = view?.displayName ?? slug;
  const isSys = role === "sys";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {view?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, not a static asset.
            <img src={view.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-line bg-card object-contain p-1" />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-hi text-base font-bold uppercase text-accent">{displayName.slice(0, 1)}</span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold leading-heading tracking-heading text-accent md:text-2xl">{displayName}</h2>
            <p className="truncate text-sm text-soft">{slug}.my-course.app</p>
          </div>
        </div>
        {view && (
          <div className="flex flex-wrap gap-1">
            {FLAG_META.filter((f) => view.flags[f.key]).map((f) => (
              <Badge key={f.key} tone="accent2">
                {f.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Panel title="Theme" hint="Brand palette, logo, favicon, home banner, and motto.">
        {view === undefined ? (
          <ListSkeleton rows={2} height="h-10" />
        ) : view === null ? (
          <EmptyLine>This tenant has no theme yet.</EmptyLine>
        ) : (
          <ThemeEditor key={slug} slug={slug} view={view} />
        )}
      </Panel>
      {isSys && (
        <Panel title="Flags" hint="Which features are on for this tenant.">
          {view === undefined ? (
            <ListSkeleton rows={3} height="h-10" />
          ) : view === null ? (
            <EmptyLine>This tenant has no flags yet.</EmptyLine>
          ) : (
            <FlagToggles key={slug} slug={slug} flags={view.flags} />
          )}
        </Panel>
      )}
      {isSys && (
        <Panel title="Donations" hint="Who this tenant's donation income is owed to. Set this before switching the Donations flag on.">
          <DonationPayee key={slug} slug={slug} />
        </Panel>
      )}
      <Panel title="Courses" hint={isSys ? "Which courses belong to this tenant." : "The courses allocated to this tenant."}>
        <TenantCourses slug={slug} canAllocate={isSys} />
      </Panel>
      {isSys && (
        <Panel title="Members" hint="Who belongs to this tenant, and its admins.">
          <TenantMembers slug={slug} />
        </Panel>
      )}
      {isSys && (
        <Panel title="Remove tenant" hint="Delete this tenant. Blocked while any course or member still references it." tone="danger">
          <TenantRemoval slug={slug} displayName={displayName} onRemoved={onRemoved} />
        </Panel>
      )}
    </div>
  );
}

// The Courses section (ticket 22): this tenant's assigned courses (each removable
// back to the default site) plus a search-and-add picker over the assignable pool
// (default-only courses). Assigning sets `topics.tenantSlug`; the live
// `courseAssignment` query re-renders both lists on every write. Tenant-centric —
// the same course is managed here, never on CourseSettings.
//
// `canAllocate` is the sys admin. Allocation is theirs both ways, so a tenant admin
// gets the assigned list read-only — no add picker, no Remove. The server agrees
// independently: `courseAssignment` returns them an empty `available` (the pool's
// titles are never sent), and assign/unassignCourse refuse them outright.
function TenantCourses({ slug, canAllocate }: { slug: string; canAllocate: boolean }) {
  const data = useQuery(api.tenantAssignment.courseAssignment, { tenantSlug: slug });
  const assign = useMutation(api.tenantAssignment.assignCourse);
  const unassign = useMutation(api.tenantAssignment.unassignCourse);

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
      {canAllocate && (
        <SearchAddPicker
          placeholder="Search a course by title…"
          empty="No unassigned courses left to add."
          options={data.available.map((c) => ({ id: c.topicId, label: c.title }))}
          onAdd={(topicId) => assign({ tenantSlug: slug, topicId: topicId as Id<"topics"> })}
        />
      )}
      {data.assigned.length === 0 ? (
        <p className="text-sm text-soft">
          {canAllocate ? "No courses assigned yet." : "No courses have been allocated to this tenant yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.assigned.map((c) => (
            <AssignedRow
              key={c.topicId}
              label={c.title}
              onRemove={
                canAllocate
                  ? () => unassign({ tenantSlug: slug, topicId: c.topicId as Id<"topics"> })
                  : undefined
              }
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
//
// **Sys-admin only** — member allocation is provisioning, so `TenantDetail` doesn't
// render this section for a tenant admin and `memberAssignment` refuses them anyway
// (its pool is platform-wide personal data). That makes every control here
// unconditionally the sys admin's: the old per-row `myAdminScope` re-check that hid
// grant/revoke from a tenant admin is gone with the tier that needed it.
function TenantMembers({ slug }: { slug: string }) {
  const data = useQuery(api.tenantAssignment.memberAssignment, { tenantSlug: slug });
  const assign = useMutation(api.tenantAssignment.assignMember);
  const unassign = useMutation(api.tenantAssignment.unassignMember);
  const setAdmin = useMutation(api.tenantAssignment.setTenantAdmin);

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
              // An admin can't be unassigned directly — demote first (revoke admin),
              // then the normal picker Remove applies (mirrors the DB-privilege lock).
              onRemove={m.isAdmin ? undefined : () => unassign({ tenantSlug: slug, email: m.email })}
              removeAria={`Unassign ${m.email}`}
              action={
                m.isAdmin
                  ? { label: "Revoke admin", busyLabel: "Revoking…", aria: `Revoke admin for ${m.email}`, run: () => setAdmin({ tenantSlug: slug, email: m.email, makeAdmin: false }) }
                  : { label: "Make admin", busyLabel: "Granting…", aria: `Make ${m.email} an admin`, run: () => setAdmin({ tenantSlug: slug, email: m.email, makeAdmin: true }) }
              }
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

  const blockers = tenantRemovalBlockers(counts);
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
          className={btnDanger}
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

// One assigned-item row: a label, an optional badge (e.g. a tenant admin), and a
// Remove control when the row is removable here. Omitting `onRemove` makes the row
// read-only — a tenant admin's allocated-courses list, or a tenant-admin member row
// (demote them first; clearing an admin's slug would promote them to a sys admin).
function AssignedRow({
  label,
  badge,
  onRemove,
  removeAria,
  action,
}: {
  label: string;
  badge?: string;
  onRemove?: () => Promise<unknown>;
  removeAria?: string;
  // An optional secondary control (e.g. "Make admin" / "Revoke admin"), rendered
  // before the remove control. Manages its own busy/error, independent of remove.
  action?: { label: string; busyLabel: string; run: () => Promise<unknown>; aria?: string };
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
      <div className="flex shrink-0 items-center gap-2">
        {action && <RowActionButton {...action} />}
        {onRemove && (
          <>
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
          </>
        )}
      </div>
    </li>
  );
}

// A secondary row action with its own busy/error state (e.g. grant/revoke admin).
function RowActionButton({ label, busyLabel, run, aria }: { label: string; busyLabel: string; run: () => Promise<unknown>; aria?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      {error && <span className="text-xs text-danger">Failed</span>}
      <button
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            await run();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        aria-label={aria}
        className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
      >
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

// The tenant's donation payee (ADR 0027) — the user the operator owes this
// tenant's donation income to, settled through the existing Payouts tab. **Sys
// admin only**, mirroring the server gate: a money destination is not a
// subdomain administrator's call. The server refuses a payee who isn't an
// approved seller with payout bank details on file, and clearing the payee also
// switches the Donations flag off, so the two can never disagree.
function DonationPayee({ slug }: { slug: string }) {
  const current = useQuery(api.tenantDonations.donationPayeeEmail, { tenantSlug: slug });
  // The only accounts the server would accept — a picker rather than a text
  // field, so the two rejections below ("no account", "not a ready seller")
  // become unreachable by construction instead of something the operator
  // discovers by typing an email and being told no.
  const candidates = useQuery(api.sellers.readySellerEmails);
  const [email, setEmail] = useState("");
  // This and `FlagToggles` below are siblings that each carried their own copy of
  // the dance, which is ticket 32's pattern in miniature. One hook now.
  const { run, busy, error } = useMutationRun(
    useMutation(api.tenantDonations.setDonationPayee),
    "Couldn't set that payee.",
  );

  async function save(next: string | undefined) {
    // The field clears only on success, so a refused save leaves the operator's
    // typing where they can see what was rejected.
    if ((await run({ tenantSlug: slug, email: next })) !== undefined) setEmail("");
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-soft">
        {current === undefined
          ? "Loading…"
          : current === null
            ? "No payee set — donations cannot be switched on."
            : `Donations are owed to ${current}.`}
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save(email);
        }}
      >
        <select
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy || !candidates?.length}
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-1.5 text-sm focus:border-accent focus:outline-none disabled:opacity-60"
        >
          <option value="">
            {candidates === undefined
              ? "Loading…"
              : candidates.length === 0
                ? "No approved sellers with payout details yet"
                : "Choose a payee…"}
          </option>
          {candidates?.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Set payee"}
        </button>
        {current && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(undefined)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// The six feature flags in display order, with human labels (issue 21). The keys
// mirror the schema's tenantFlagsValidator (issue 04); enforced server-side by
// assertTenantFlag (issue 17), this is only the operator's on/off surface.
const FLAG_META: { key: TenantFlag; label: string; hint: string }[] = [
  { key: "certificates", label: "Certificates", hint: "Learners can claim a completion certificate." },
  { key: "translations", label: "Translations", hint: "Owners can translate a completed course into other languages." },
  { key: "publicLinks", label: "Public links", hint: "Owners can publish a shareable public link to a course." },
  { key: "qa", label: "Questions & feedback", hint: "Learners can ask or leave feedback on a lesson; the next lesson answers it and builds on it." },
  { key: "seeding", label: "Course creation", hint: "Members can seed new courses on this tenant." },
  // The one flag with a precondition (ADR 0027): the server refuses to switch it
  // on until a donation payee is set and is a ready seller, and says so.
  { key: "donations", label: "Donations", hint: "Show the donation section on this tenant's landing page." },
];

// The Flags section (ticket 21): one plain switch per feature flag over the
// scope-gated setTenantFlags patch. Flag-off is frozen-not-revoked (issue 04), so
// there's no confirm dialog — a toggle only changes what the server permits going
// forward, granting and deleting nothing. The live getTheme query drives `flags`,
// so a toggle reflects immediately (Convex reactivity); a per-key busy flag guards
// against a double-click mid-write. Keyed by slug at the call site so switching
// tenants remounts with fresh state.
function FlagToggles({ slug, flags }: { slug: string; flags: Partial<Record<TenantFlag, boolean>> }) {
  const { run, busy: writing, error } = useMutationRun(
    useMutation(api.tenantFlags.setTenantFlags),
    "Couldn't update that flag.",
  );
  // Which flag is mid-write, not merely that one is: the per-key busy flag is
  // what stops a double-click on ONE switch, and the shared hook cannot know
  // which row asked. So this keeps the key and takes the rest from the hook.
  const [pending, setPending] = useState<TenantFlag | null>(null);
  const busy = writing ? pending : null;

  async function toggle(key: TenantFlag, next: boolean) {
    setPending(key);
    await run({ tenantSlug: slug, flags: { [key]: next } });
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-1 text-ink">
      {FLAG_META.map(({ key, label, hint }) => {
        // `donations` is optional in the schema — absence means off (ADR 0027),
        // which is why it needed no backfill over every tenant row.
        const on = flags[key] ?? false;
        return (
          <div key={key} className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <b className="block text-[13.5px] font-semibold text-ink">{label}</b>
              <span className="text-[11.5px] text-soft">{hint}</span>
            </div>
            <Switch checked={on} disabled={busy !== null} onChange={(next) => void toggle(key, next)} label={label} />
          </div>
        );
      })}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// The tenant view getTheme resolves (issue 11) — a non-null tenant's resolved
// palette + brand asset urls, which the editor seeds from.
type TenantThemeView = NonNullable<FunctionReturnType<typeof api.tenantTheme.getTheme>>;
// `Palette` comes from `adminDerive` with the validators that produce one.

// Short human labels for the structured token fields — the semantic role of each
// token (mirrors the contract in src/design/tokens.ts). The token name is shown
// alongside so a JSON paste and a structured field are obviously the same key.
const TOKEN_LABELS: Record<Token, string> = {
  paper: "Page background",
  card: "Raised surface",
  ink: "Primary text",
  soft: "Muted text",
  line: "Hairline borders",
  accent: "Primary brand",
  accent2: "Secondary brand",
  gold: "Highlight / ornament",
  hi: "Highlight-mark bg",
  danger: "Error / destructive",
  good: "Correct-answer surface",
  "good-b": "Correct-answer accent",
  bad: "Wrong-answer surface",
  "bad-b": "Wrong-answer accent",
};

// The palette import moved to `adminDerive.ts` on 2026-09-08 (ticket 34). It had
// six distinct throws and no tests, and was reachable only by typing into a
// textarea. It mirrors the server's `assertThemeTokens`; the two were checked
// against each other before the move and have not drifted.

// The Theme section's editor (ticket 20): JSON import + structured per-token
// fields (light/dark tabs) + a live preview, over the identity-guarded
// updateTenantTheme. Edit-is-live (03) — Save patches `tenants.theme` and the
// tenant's subdomain reflects it on the next SSR render (11), no draft state.
// Keyed by slug at the call site so switching tenants remounts with fresh state,
// so local edits never bleed across tenants and the live getTheme never clobbers
// an in-progress edit.
function ThemeEditor({ slug, view }: { slug: string; view: TenantThemeView }) {
  const save = useMutation(api.tenantTheme.updateTenantTheme);

  // Editable palettes seeded from the tenant's current theme: light is complete
  // (all 14); dark is a partial override map (only the tokens the tenant set).
  const [light, setLight] = useState<Palette>(() => ({ ...view.theme.light }));
  const [dark, setDark] = useState<Palette>(() => ({ ...(view.theme.dark ?? {}) }));
  const [tab, setTab] = useState<"light" | "dark">("light");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setToken(mode: "light" | "dark", tok: string, value: string) {
    setSaved(false);
    (mode === "light" ? setLight : setDark)((prev) => ({ ...prev, [tok]: value }));
  }
  function clearDarkToken(tok: string) {
    setSaved(false);
    setDark((prev) => {
      const next = { ...prev };
      delete next[tok];
      return next;
    });
  }

  function applyImport() {
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError("That isn't valid JSON.");
      return;
    }
    try {
      const next = coerceImportedTheme(parsed);
      if (next.light) setLight(next.light);
      if (next.dark !== undefined) setDark(next.dark);
      setImportText("");
      setSaved(false);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Couldn't read that palette.");
    }
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    const missing = TENANT_THEME_TOKENS.filter((tok) => !light[tok]?.trim());
    if (missing.length) {
      setError(`Light palette is missing: ${missing.join(", ")}`);
      setTab("light");
      return;
    }
    setBusy(true);
    try {
      const theme: { light: Palette; dark?: Palette } = {
        // Every light token is present (the missing-check above guarantees it).
        light: Object.fromEntries(TENANT_THEME_TOKENS.map((tok) => [tok, light[tok]!])),
      };
      const darkEntries = Object.fromEntries(
        TENANT_THEME_TOKENS.filter((tok) => dark[tok]?.trim()).map((tok) => [tok, dark[tok]!]),
      );
      if (Object.keys(darkEntries).length) theme.dark = darkEntries;
      await save({ tenantSlug: slug, theme });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the theme.");
    } finally {
      setBusy(false);
    }
  }

  // Preview the active tab. Dark shows its overrides on the light base for the
  // tokens it doesn't set (a representative approximation — the real fallback is
  // the default dark palette, which the client doesn't carry).
  const activePalette = tab === "light" ? light : { ...light, ...dark };
  const previewStyle = Object.fromEntries(
    TENANT_THEME_TOKENS.filter((tok) => activePalette[tok]).map((tok) => [`--color-${tok}`, activePalette[tok]]),
  ) as CSSProperties;

  return (
    <div className="flex flex-col gap-6 text-ink">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-accent2">Import palette (JSON)</label>
        <p className="mt-0.5 text-xs text-soft">
          Paste a full 14-token set as <code>{`{ "light": { … }, "dark": { … } }`}</code> (dark optional). Applying
          fills the fields below — nothing saves until you press Save.
        </p>
        <textarea
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportError(null);
          }}
          rows={4}
          placeholder='{ "light": { "paper": "#fbf7f0", … } }'
          className="mt-2 w-full rounded-lg border border-line bg-card px-3 py-2 font-mono text-xs focus:border-gold focus:outline-none"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyImport}
            disabled={!importText.trim()}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          >
            Apply to fields
          </button>
          {importError && <span className="text-xs text-danger">{importError}</span>}
        </div>
      </div>

      <div className="flex gap-1 self-start rounded-lg border border-line bg-card p-1">
        <ModeButton active={tab === "light"} onClick={() => setTab("light")}>
          Light
        </ModeButton>
        <ModeButton active={tab === "dark"} onClick={() => setTab("dark")}>
          Dark
        </ModeButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          {tab === "dark" && (
            <p className="text-xs text-soft">
              Dark is optional and partial — set only the tokens to override; the rest fall back to the default dark
              palette.
            </p>
          )}
          {TENANT_THEME_TOKENS.map((tok) => (
            <TokenField
              key={tok}
              token={tok}
              label={TOKEN_LABELS[tok]}
              value={tab === "light" ? (light[tok] ?? "") : (dark[tok] ?? "")}
              overridden={tab === "light" || Boolean(dark[tok])}
              mode={tab}
              onChange={(v) => setToken(tab, tok, v)}
              onClear={tab === "dark" ? () => clearDarkToken(tok) : undefined}
            />
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent2">Preview ({tab})</p>
          <div style={previewStyle} className="rounded-xl border border-line bg-paper p-4">
            <p className="text-sm font-semibold text-accent">Sample heading</p>
            <div className="mt-3 rounded-lg border border-line bg-card p-3">
              <p className="text-sm text-ink">A card surface with primary text.</p>
              <p className="mt-1 text-xs text-soft">Muted secondary text.</p>
              <a className="mt-2 inline-block text-xs text-accent underline underline-offset-2">A link</a>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-good-b bg-good px-2 py-0.5 text-[11px] text-good-b">Correct</span>
                <span className="rounded-md border border-bad-b bg-bad px-2 py-0.5 text-[11px] text-bad-b">Wrong</span>
                <span className="rounded-md bg-hi px-2 py-0.5 text-[11px] text-ink">Highlight</span>
                <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] text-white">Gold</span>
              </div>
              <button className="mt-3 rounded-md bg-accent px-3 py-1 text-xs font-medium text-white">Primary action</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save theme"}
        </button>
        {saved && <span className="text-xs text-accent2">Saved — live on the subdomain now.</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      <AssetUploads slug={slug} logoUrl={view.logoUrl} faviconUrl={view.faviconUrl} bannerUrl={view.bannerUrl} />
      <MottoEditor slug={slug} motto={view.motto} />
    </div>
  );
}

// A light/dark toggle within the theme editor (kept local to avoid coupling to the
// page-level TabButton, which styles a different context).
function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-soft hover:bg-hi hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

// One structured token field: a native colour picker paired with the exact hex
// text. The picker only understands 6-digit hex, so it seeds from a normalised
// value while the text field keeps the authored string verbatim (#fff, rgb(), a
// var). On the dark tab an empty field means "not overridden" and the × clears it.
function TokenField({
  token,
  label,
  value,
  overridden,
  mode,
  onChange,
  onClear,
}: {
  token: string;
  label: string;
  value: string;
  overridden: boolean;
  mode: "light" | "dark";
  onChange: (v: string) => void;
  onClear?: () => void;
}) {
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} colour picker`}
        value={swatch}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-line bg-card p-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-ink">{label}</span>
          <code className="shrink-0 text-[10px] text-soft">{token}</code>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={mode === "dark" ? "(default dark)" : "#…"}
          className="mt-0.5 w-full rounded border border-line bg-card px-2 py-1 font-mono text-xs focus:border-gold focus:outline-none"
        />
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={!overridden}
          aria-label={`Clear ${label} dark override`}
          className="shrink-0 rounded px-1.5 py-1 text-sm text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-40"
        >
          ×
        </button>
      )}
    </div>
  );
}

// The motto shown under the tenant's logo on sign-in and the dashboard, in
// place of the default site's fixed "Your learning workspace" tagline. A
// single text input + save, mirroring the theme editor's own save button
// rather than autosaving on change.
function MottoEditor({ slug, motto }: { slug: string; motto: string | null }) {
  const save = useMutation(api.tenantTheme.updateTenantMotto);
  const [value, setValue] = useState(motto ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await save({ tenantSlug: slug, motto: value });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the motto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent2">Motto</p>
      <p className="mt-0.5 text-xs text-soft">The subtitle under the logo on sign-in and the dashboard.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Your learning workspace"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save motto"}
        </button>
        {saved && <span className="text-xs text-accent2">Saved.</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}

// Logo + favicon upload slots (issue 12), wired to the identity-guarded
// setTenantAsset via the shared generateUploadUrl → POST → record rail. The file
// uploads as-is (raster only; the server refuses SVG and caps size at 256 KB) so a
// logo keeps its aspect ratio. The live getTheme query re-resolves the new url, so
// the slot's thumbnail and the header logo update on their own after a save.
function AssetUploads({
  slug,
  logoUrl,
  faviconUrl,
  bannerUrl,
}: {
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent2">Brand assets</p>
      <p className="mt-0.5 text-xs text-soft">
        PNG, JPEG, or WebP. Up to 256&nbsp;KB for the logo and favicon, 1&nbsp;MB for the home banner (it is
        full-width, so it needs the room). Uploads are live immediately.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <AssetSlot slug={slug} asset="logo" label="Logo" currentUrl={logoUrl} />
        <AssetSlot slug={slug} asset="favicon" label="Favicon" currentUrl={faviconUrl} />
        <AssetSlot slug={slug} asset="banner" label="Home banner" currentUrl={bannerUrl} />
      </div>
    </div>
  );
}

function AssetSlot({
  slug,
  asset,
  label,
  currentUrl,
}: {
  slug: string;
  asset: "logo" | "favicon" | "banner";
  label: string;
  currentUrl: string | null;
}) {
  const generateUploadUrl = useMutation(api.resources.generateUploadUrl);
  const setAsset = useMutation(api.tenantTheme.setTenantAsset);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.type === "image/svg+xml") {
      setError("SVG isn't allowed — use a PNG, JPEG, or WebP.");
      return;
    }
    // Checked here as well as on the server so the admin reads their own limit
    // rather than the shared upload rail and its "emblem image is too large".
    const maxBytes = asset === "banner" ? 1024 * 1024 : 256 * 1024;
    if (file.size > maxBytes) {
      setError(`That file is ${Math.round(file.size / 1024)} KB. The limit here is ${maxBytes / 1024} KB.`);
      return;
    }
    setBusy(true);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(`upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setAsset({ tenantSlug: slug, asset, storageId, contentType: file.type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-paper ${
            asset === "banner" ? "w-28" : "w-12"
          }`}
        >
          {currentUrl ? (
            <img src={currentUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-soft">none</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{label}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="mt-1 rounded-lg border border-line px-2.5 py-1 text-xs text-soft transition-colors hover:bg-hi hover:text-accent disabled:opacity-60"
          >
            {busy ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

// Add an email to the Allowlist. The mutation normalises + validates; on success
// the live list re-renders with the new row, so there's nothing to do here but
// clear the field. It sits in the Allowlist panel's header, beside the list it
// adds to. No autoFocus: the Allowlist is a list you come to read, and focusing
// the field on mount scrolled the roster out of view on a phone.
function AddEmailForm() {
  const addEmail = useMutation(api.whitelist.addEmail);
  return (
    <InlineEmailForm
      placeholder="name@example.com"
      label="Admit"
      busyLabel="Adding…"
      failure="Couldn't add. Check it's a valid email address."
      onSubmit={(email) => addEmail({ email })}
    />
  );
}

// The one "type an email, press the button" form the Allowlist and Sellers
// panels share. The field clears on success and stays put on a refusal.
function InlineEmailForm({
  placeholder,
  label,
  busyLabel,
  failure,
  onSubmit,
}: {
  placeholder: string;
  label: string;
  busyLabel: string;
  failure: string;
  onSubmit: (email: string) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        const addr = email.trim();
        if (!addr) return;
        setBusy(true);
        setError(null);
        try {
          await onSubmit(addr);
          setEmail("");
        } catch {
          setError(failure);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder={placeholder}
          className={`${inputCls} w-56 py-1.5`}
        />
        <button type="submit" disabled={busy || !email.trim()} className={`${btnPrimary} py-1.5`}>
          <Icon name="plus" className="h-4 w-4" />
          {busy ? busyLabel : label}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// One Allowlist row's remove. The Admin's own row never gets one: the
// non-removable-Admin guard (also enforced server-side in removeEmail).
function RemoveEmailButton({ email }: { email: string }) {
  const removeEmail = useMutation(api.whitelist.removeEmail);
  return <RowActionButton label="Remove" busyLabel="Removing…" aria={`Remove ${email}`} run={() => removeEmail({ email })} />;
}
