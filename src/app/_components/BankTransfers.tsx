"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Icon } from "./icons";
import { formatPrice } from "./Paygate";
import { ConfirmDialog, Dialog } from "./ui";

// Bank transfer payments (.scratch/bank-transfer-payments) — the owner's two
// surfaces: the **Collection accounts** they ask buyers to transfer into (one per
// region), and the queue of references awaiting their approval. Approving a
// reference is what grants the buyer access, so this is the money screen: it
// shows what to look for on a bank statement (reference, amount, account) and one
// button that turns "the money arrived" into an Entitlement.
//
// The same queue serves the Admin with `all` (they may decide any course's
// transfers) — the server derives the scope from the caller either way.

type Account = FunctionReturnType<typeof api.bankTransfer.myBankAccounts>[number];
type Pending = FunctionReturnType<typeof api.bankTransfer.pendingTransfers>[number];

// A blank Collection account form. `country`/`currency` are typed as codes (the
// server validates the shape) — the label is what a buyer actually picks from.
const BLANK = {
  label: "",
  country: "",
  currency: "",
  accountHolder: "",
  bankName: "",
  accountNumber: "",
  routingCode: "",
  swift: "",
  instructions: "",
};
type Form = typeof BLANK;

// ---- the owner's dashboard section ------------------------------------------

// Shown to anyone who could take a bank transfer: a ready Seller (they can price,
// so they may want somewhere to be paid), plus anyone who already has an account
// set up or a payment waiting — so the section never vanishes out from under work
// in progress.
export function BankTransfersSection() {
  const t = useTranslations("BankTransfers");
  const pending = useQuery(api.bankTransfer.pendingTransfers, {});
  const accounts = useQuery(api.bankTransfer.myBankAccounts, {});
  const sellerStatus = useQuery(api.sellers.sellerStatus);
  const [managing, setManaging] = useState(false);

  const relevant = !!pending?.length || !!accounts?.length || sellerStatus === "ready";
  if (!relevant) return null;

  return (
    <section className="mt-12">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-accent">{t("sectionTitle")}</h2>
          <p className="mt-0.5 text-sm text-soft">{t("sectionSubtitle")}</p>
        </div>
        <button
          onClick={() => setManaging(true)}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-soft transition-colors hover:bg-hi hover:text-accent"
        >
          <Icon name="globe" className="mr-1.5 inline h-3.5 w-3.5" />
          {t("manageAccounts", { count: accounts?.length ?? 0 })}
        </button>
      </div>
      <TransferQueue all={false} />
      {managing && <BankAccountsDialog onClose={() => setManaging(false)} />}
    </section>
  );
}

// ---- the approval queue -----------------------------------------------------

// The references awaiting a decision. `all` asks for every course's (honoured for
// the Admin only — an owner still gets exactly their own rows).
export function TransferQueue({ all }: { all: boolean }) {
  const t = useTranslations("BankTransfers");
  const pending = useQuery(api.bankTransfer.pendingTransfers, all ? { all: true } : {});

  if (pending === undefined) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {[0, 1].map((i) => (
          <li key={i} className="h-20 animate-pulse rounded-xl border border-line bg-card" />
        ))}
      </ul>
    );
  }
  if (pending.length === 0) {
    return <p className="rounded-xl border border-dashed border-line px-3.5 py-3 text-[13px] text-soft">{t("queueEmpty")}</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {pending.map((p) => (
        <TransferRow key={p.reference} transfer={p} />
      ))}
    </ul>
  );
}

// One awaiting payment: what to match against a bank statement, then the decision.
// Approving expands a short form first — the amount that actually arrived (a
// cross-border transfer often lands light) and a note — because the Ledger should
// record the real money, not the sticker price.
function TransferRow({ transfer }: { transfer: Pending }) {
  const t = useTranslations("BankTransfers");
  const approve = useMutation(api.bankTransfer.approveBankTransfer);
  const decline = useMutation(api.bankTransfer.declineBankTransfer);
  const [open, setOpen] = useState(false);
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await fn();
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const confirmApproval = () => {
    // Blank = paid in full; a typed major-unit amount becomes minor units.
    const typed = received.trim();
    const minor = typed ? Math.round(parseFloat(typed) * 100) : undefined;
    if (typed && (!Number.isFinite(minor!) || minor! < 0)) {
      setError(true);
      return;
    }
    void run(() =>
      approve({
        reference: transfer.reference,
        ...(minor !== undefined ? { receivedAmount: minor } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    );
  };

  return (
    <li className="rounded-xl border border-gold/40 bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block font-mono text-sm font-semibold tracking-wide text-ink">{transfer.reference}</b>
          <span className="mt-0.5 block truncate text-xs text-soft">
            {transfer.courseTitle} · {transfer.lang} · {transfer.buyerEmail}
          </span>
          <span className="mt-0.5 block text-xs text-soft">
            {t("intoAccount", { account: transfer.accountLabel })} ·{" "}
            {new Date(transfer.requestedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-sm font-bold tabular-nums text-gold">
          {formatPrice(transfer.amount, transfer.currency)}
        </span>
      </div>

      {open ? (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">
              {t("receivedLabel", { currency: transfer.currency.toUpperCase() })}
            </span>
            <input
              value={received}
              inputMode="decimal"
              onChange={(e) => {
                setReceived(e.target.value);
                setError(false);
              }}
              placeholder={(transfer.amount / 100).toFixed(2)}
              className="w-40 rounded-lg border border-line bg-card px-3 py-2 text-sm tabular-nums focus:border-gold focus:outline-none"
            />
            <span className="text-[11px] text-soft">{t("receivedHint")}</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={confirmApproval}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {busy ? t("granting") : t("confirmApproval")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12.5px] text-soft transition-colors hover:text-accent"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
          >
            {t("approve")}
          </button>
          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-soft transition-colors hover:text-danger"
          >
            <Icon name="x" className="h-3.75 w-3.75" /> {t("decline")}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{t("actionFailed")}</p>}

      {declining && (
        <ConfirmDialog
          title={t("declineTitle")}
          body={t("declineBody", { reference: transfer.reference })}
          confirmLabel={t("decline")}
          onClose={() => setDeclining(false)}
          onConfirm={() => {
            setDeclining(false);
            void run(() => decline({ reference: transfer.reference, ...(note.trim() ? { note: note.trim() } : {}) }));
          }}
        />
      )}
    </li>
  );
}

// ---- Collection accounts ----------------------------------------------------

// The owner's regional accounts: add one per region, correct one in place, retire
// one from the buyer's picker. Retiring never deletes — a Bank transfer that named
// the account must keep resolving.
function BankAccountsDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("BankTransfers");
  const accounts = useQuery(api.bankTransfer.myBankAccounts, {});
  const [adding, setAdding] = useState(false);

  return (
    <Dialog title={t("accountsTitle")} onClose={onClose}>
      <p className="text-sm leading-relaxed text-soft">{t("accountsIntro")}</p>

      {accounts === undefined ? (
        <div className="mt-4 h-16 animate-pulse rounded-xl border border-line bg-card" />
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {accounts.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3 rounded-xl border border-line bg-card p-3.5">
          <AccountForm onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gold/20 px-3.5 py-2 text-sm font-medium text-accent transition-colors hover:bg-gold/30"
        >
          <Icon name="plus" className="h-4 w-4" /> {t("addAccount")}
        </button>
      )}
    </Dialog>
  );
}

function AccountRow({ account }: { account: Account }) {
  const t = useTranslations("BankTransfers");
  const setDisabled = useMutation(api.bankTransfer.setBankAccountDisabled);
  const [editing, setEditing] = useState(false);
  const d = account.details;

  if (editing) {
    return (
      <li className="rounded-xl border border-line bg-card p-3.5">
        <AccountForm id={account.id} initial={d} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className={`rounded-xl border bg-card px-3.5 py-3 ${account.disabled ? "border-dashed border-line" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <b className="block text-[13.5px] font-semibold text-ink">
            {d.label}
            {account.disabled && <span className="ml-2 text-[11px] font-normal text-soft">{t("retired")}</span>}
          </b>
          <span className="mt-0.5 block truncate text-xs text-soft">
            {d.accountHolder} · {d.bankName} · {d.accountNumber}
            {d.routingCode ? ` · ${d.routingCode}` : ""}
          </span>
          <span className="text-xs text-soft">
            {d.country} · {d.currency.toUpperCase()}
            {d.swift ? ` · ${d.swift}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-line px-2.5 py-1 text-[12px] text-soft transition-colors hover:bg-hi hover:text-accent"
          >
            {t("edit")}
          </button>
          <button
            onClick={() => void setDisabled({ id: account.id, disabled: !account.disabled })}
            className="rounded-lg px-2.5 py-1 text-[12px] text-soft transition-colors hover:bg-hi hover:text-accent"
          >
            {account.disabled ? t("restore") : t("retire")}
          </button>
        </div>
      </div>
    </li>
  );
}

// Add or correct one Collection account. Regional by design: `routingCode` is one
// free-form field (IFSC in India, branch code in South Africa, sort code in the
// UK), which the owner explains to the buyer in `instructions`.
function AccountForm({
  id,
  initial,
  onDone,
}: {
  id?: Id<"bankAccounts">;
  initial?: Account["details"];
  onDone: () => void;
}) {
  const t = useTranslations("BankTransfers");
  const add = useMutation(api.bankTransfer.addBankAccount);
  const update = useMutation(api.bankTransfer.updateBankAccount);
  const [form, setForm] = useState<Form>({
    ...BLANK,
    ...initial,
    currency: initial ? initial.currency.toUpperCase() : "",
    routingCode: initial?.routingCode ?? "",
    swift: initial?.swift ?? "",
    instructions: initial?.instructions ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof Form, label: string, placeholder: string) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => {
          setForm((f) => ({ ...f, [key]: e.target.value }));
          setError(null);
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </label>
  );

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          if (id) await update({ id, ...form });
          else await add(form);
          onDone();
        } catch (err) {
          // The server's message names the offending field, which is more useful
          // than a generic failure on a form this long.
          setError(err instanceof Error ? err.message.replace(/^\[.*?]\s*/, "") : t("accountSaveError"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {field("label", t("labelField"), t("labelPlaceholder"))}
        {field("country", t("countryField"), t("countryPlaceholder"))}
        {field("currency", t("currencyField"), t("currencyPlaceholder"))}
        {field("accountHolder", t("holderField"), t("holderPlaceholder"))}
        {field("bankName", t("bankField"), t("bankPlaceholder"))}
        {field("accountNumber", t("numberField"), t("numberPlaceholder"))}
        {field("routingCode", t("routingField"), t("routingPlaceholder"))}
        {field("swift", t("swiftField"), t("swiftPlaceholder"))}
      </div>
      {field("instructions", t("instructionsField"), t("instructionsPlaceholder"))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? t("saving") : t("saveAccount")}
        </button>
        <button type="button" onClick={onDone} className="text-[12.5px] text-soft transition-colors hover:text-accent">
          {t("cancel")}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
