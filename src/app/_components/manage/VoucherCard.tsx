"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import { type FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Icon } from "../icons";
import { formatPrice } from "../Paygate";
import { ConfirmDialog } from "../ui";

// The ONE voucher control (ui-overhaul 15): the two bulk rails, Organisation
// Voucher (ADR 0031) and Bulk Vouchers (ADR 0029), merged into a single card
// whose mode picks DISTRIBUTION, one shared code against one code each. The
// backends stay two backends (`accessCodes` and `voucherBatches`, untouched);
// only the presentation merges.
//
// Each mode states its billing and its identity consequence in a line, because
// one radio button now decides whether the buyer's members consent to anything
// and whether a roster of handles exists. The owner signed the deal and is the
// only person who can answer for that, so the picker tells them here, not in an
// ADR.
//
// **The platform sends nothing to anyone.** It has no member addresses, which
// is the whole point of both rails, so delivery is the organisation's job and
// the Seller's hand-off is a copyable code or a CSV download.
//
// **The Seller must never see a nickname**, and this is the surface where that
// promise is most likely to be broken by somebody being helpful. `myAccessCodes`
// cannot return a nickname or a user id (its returns validator refuses to), and
// nothing here may add a route around that: no roster, no list, no breakdown of
// the count by anything at all. Take-up is a NUMBER and it stays one. Likewise a
// Bulk Voucher redemption records `redeemedAt` and nothing else, so there is no
// WHO to show and none may be approximated.
type Mode = "shared" | "each";

export function VoucherCard({
  topicSlug,
  lang,
  name,
  published,
}: {
  topicSlug: string;
  lang: string;
  name: string;
  published: boolean;
}) {
  const t = useTranslations("Editions");
  const status = useQuery(api.sellers.sellerStatus);
  const batches = useQuery(api.vouchers.myBatches);
  const codes = useQuery(api.accessCodes.myAccessCodes);
  // Shared first: ADR 0031's ordering (broadcastability was the buyer's first
  // ask), and the mode with the only real usage.
  const [mode, setMode] = useState<Mode>("shared");
  const [minting, setMinting] = useState(false);

  const myBatches = (batches ?? []).filter((b) => b.topicSlug === topicSlug && b.lang === lang);
  const myCodes = (codes ?? []).filter((c) => c.topicSlug === topicSlug && c.lang === lang);

  // The same gate minting itself enforces. SellEdition above already explains
  // how to become a ready Seller, so this card stays silent until then.
  if (status !== "ready") return null;

  const modes: { key: Mode; title: string; billing: string; identity: string }[] = [
    { key: "shared", title: t("modeSharedTitle"), billing: t("modeSharedBilling"), identity: t("modeSharedIdentity") },
    { key: "each", title: t("modeEachTitle"), billing: t("modeEachBilling"), identity: t("modeEachIdentity") },
  ];

  return (
    <div className="rounded-xl border border-line bg-card p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-hi text-soft">
          <Icon name="users" className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <b className="block text-[13.5px] font-semibold text-ink">{t("voucherTitle")}</b>
          <span className="text-[11.5px] text-soft">{t("voucherBlurb")}</span>
        </div>
      </div>

      {/* The distribution picker. Billing and identity are consequences of this
          choice, stated per mode, never picked in the abstract. */}
      <div role="radiogroup" aria-label={t("voucherModeLabel")} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={mode === m.key}
            onClick={() => {
              setMode(m.key);
              setMinting(false);
            }}
            className={`flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-colors ${
              mode === m.key ? "border-accent bg-accent/5" : "border-line hover:bg-hi"
            }`}
          >
            <span className={`text-[13px] font-semibold ${mode === m.key ? "text-accent" : "text-ink"}`}>{m.title}</span>
            <span className="text-[11px] leading-snug text-soft">{m.billing}</span>
            <span className="text-[11px] leading-snug text-soft">{m.identity}</span>
          </button>
        ))}
      </div>

      {/* Minting needs a PUBLISHED Edition (the server refuses otherwise), so
          say so rather than offering a form that always fails. */}
      {!published ? (
        <p className="mt-2.5 text-[11.5px] text-soft">{t("voucherPublishFirst")}</p>
      ) : (
        <button
          type="button"
          onClick={() => setMinting((o) => !o)}
          className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          {minting ? t("voucherClose") : mode === "shared" ? t("accessNew") : t("batchNew")}
        </button>
      )}

      {minting &&
        published &&
        (mode === "shared" ? (
          <MintAccessCodeForm topicSlug={topicSlug} lang={lang} onMinted={() => setMinting(false)} />
        ) : (
          <MintBatchForm topicSlug={topicSlug} lang={lang} onMinted={() => setMinting(false)} />
        ))}

      {mode === "shared" && myCodes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {myCodes.map((c) => (
            <AccessCodeRow key={c.accessCodeId} code={c} />
          ))}
        </ul>
      )}
      {mode === "each" && myBatches.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {myBatches.map((b) => (
            <BatchRow key={b.batchId} batch={b} editionName={name} />
          ))}
        </ul>
      )}
    </div>
  );
}

// The "one shared code" mint form (Organisation Voucher, ADR 0031). Four fields
// because the deal IS four facts: how many seats it is good for, what one seat
// costs, and who the Seller struck the deal with. No discount machinery, no
// approval step: the Seller states the per-seat price.
function MintAccessCodeForm({ topicSlug, lang, onMinted }: { topicSlug: string; lang: string; onMinted: () => void }) {
  const t = useTranslations("Editions");
  const mint = useMutation(api.accessCodes.mintAccessCode);
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgContact, setOrgContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const seats = Number(capacity);
        // Rand in, cents out; the server re-checks both bounds.
        const cents = Math.round(parseFloat(price) * 100);
        if (!Number.isInteger(seats) || seats < 1 || !Number.isFinite(cents) || cents <= 0) {
          setError(t("accessError"));
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await mint({ topicSlug, lang, capacity: seats, pricePerSeat: cents, orgName, orgContact });
          onMinted();
        } catch {
          // The server's own refusals are plain Errors, which a production
          // deployment redacts, so this says what a Seller can actually check.
          setError(t("accessError"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label={t("accessCapacityLabel")} value={capacity} set={setCapacity} placeholder="500" mode="numeric" onEdit={() => setError(null)} />
        <Field label={t("accessPriceLabel")} value={price} set={setPrice} placeholder="0.00" mode="numeric" onEdit={() => setError(null)} />
        <Field label={t("accessOrgLabel")} value={orgName} set={setOrgName} placeholder={t("accessOrgPlaceholder")} onEdit={() => setError(null)} />
        <Field label={t("accessContactLabel")} value={orgContact} set={setOrgContact} placeholder={t("accessContactPlaceholder")} onEdit={() => setError(null)} />
      </div>
      {/* The one thing a Seller must not be surprised by, and it is the opposite
          of a batch's surprise: nothing is billed now. The bill is written when
          they stop the code, for the seats actually taken. */}
      <p className="text-[11.5px] leading-relaxed text-soft">{t("accessMintHint")}</p>
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {busy ? t("accessMinting") : t("accessMint")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// The "one code each" mint form (Bulk Vouchers, ADR 0029). Four fields because
// the batch IS four facts: how many seats, the total the Seller negotiated, and
// who they negotiated it with.
function MintBatchForm({ topicSlug, lang, onMinted }: { topicSlug: string; lang: string; onMinted: () => void }) {
  const t = useTranslations("Editions");
  const mint = useMutation(api.vouchers.mintBatch);
  const [seats, setSeats] = useState("");
  const [total, setTotal] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgContact, setOrgContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const count = Number(seats);
        // Rand in, cents out; the server re-checks both bounds.
        const cents = Math.round(parseFloat(total) * 100);
        if (!Number.isInteger(count) || count < 1 || !Number.isFinite(cents) || cents <= 0) {
          setError(t("batchError"));
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await mint({ topicSlug, lang, seats: count, total: cents, orgName, orgContact });
          onMinted();
        } catch {
          setError(t("batchError"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label={t("batchSeatsLabel")} value={seats} set={setSeats} placeholder="100" mode="numeric" onEdit={() => setError(null)} />
        <Field label={t("batchTotalLabel")} value={total} set={setTotal} placeholder="0.00" mode="numeric" onEdit={() => setError(null)} />
        <Field label={t("batchOrgLabel")} value={orgName} set={setOrgName} placeholder={t("batchOrgPlaceholder")} onEdit={() => setError(null)} />
        <Field label={t("batchContactLabel")} value={orgContact} set={setOrgContact} placeholder={t("batchContactPlaceholder")} onEdit={() => setError(null)} />
      </div>
      {/* The one thing a Seller must not be surprised by: the codes are live at
          once, and the money is a separate, later, manual event. */}
      <p className="text-[11.5px] leading-relaxed text-soft">{t("batchMintHint")}</p>
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {busy ? t("batchMinting") : t("batchMint")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

function Field({
  label,
  value,
  set,
  placeholder,
  mode,
  onEdit,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder: string;
  mode?: "numeric";
  onEdit: () => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{label}</span>
      <input
        value={value}
        inputMode={mode}
        placeholder={placeholder}
        onChange={(e) => {
          set(e.target.value);
          onEdit();
        }}
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </label>
  );
}

// One batch: who bought it, take-up, payment state, and the download.
function BatchRow({
  batch,
  editionName,
}: {
  batch: FunctionReturnType<typeof api.vouchers.myBatches>[number];
  editionName: string;
}) {
  const t = useTranslations("Editions");
  const convex = useConvex();
  const voidBatch = useMutation(api.vouchers.voidBatch);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Collapsed by default: the summary line (who, how many, how much) is the
  // part a Seller scans; the rest opens on a click.
  const [open, setOpen] = useState(false);
  // Read after mount, not during render, because `window` does not exist on the
  // server. The CURRENT host on purpose: `/redeem` is served on every host, so a
  // Seller on their own whitelabel domain hands out their own domain.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const redeemUrl = origin ? `${origin}/redeem` : "";

  // ponytail: a CSV is a string with commas and newlines, and the download is a
  // blob. The codes are fetched on the click rather than subscribed to, because
  // a page holding every code open leaks them into a screen-share.
  const download = async () => {
    setBusy(true);
    try {
      const codes = await convex.query(api.vouchers.batchCodes, { batchId: batch.batchId });
      // Course, language and a per-row redeem link ride along so the file is
      // mail-mergeable and printable. Headers stay English: this is a data file
      // the organisation processes, not a page anybody reads.
      const rows = [
        ["code", "course", "language", "redeem at"],
        ...codes.map((code) => [code, batch.courseTitle, editionName, `${origin}/redeem?code=${code}`]),
      ];
      const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batch.orgName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() || "batch"}-codes.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`rounded-lg border px-3 py-2.5 ${batch.voided ? "border-line bg-hi/40" : "border-line bg-hi"}`}>
      {/* The whole summary is the toggle: a Seller aiming at a 16px glyph on a
          phone misses. Its accessible name is the organisation. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <b className="block truncate text-[13px] font-semibold text-ink">{batch.orgName}</b>
          <span className="text-[11.5px] text-soft">
            {t("batchTakeUp", { redeemed: batch.redeemed, seats: batch.seats })} · {formatPrice(batch.total, "ZAR")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {batch.voided && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-danger">
              {t("batchVoidedBadge")}
            </span>
          )}
          <Icon name="chevron" className={`h-4 w-4 shrink-0 text-soft transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <>
          {/* Stated plainly: a Seller looking at an unlogged batch should know
              their share is not payable yet and why. */}
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-soft">
            {batch.paymentRef ? t("batchPaymentLogged", { reference: batch.paymentRef }) : t("batchAwaitingPayment")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void download()}
              className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
            >
              {t("batchDownload")}
            </button>
            {!batch.voided && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium text-soft transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
              >
                {t("batchVoid")}
              </button>
            )}
          </div>
          {/* The Seller is the only person who can tell the organisation where
              the codes are typed; the platform sends nothing to anybody. */}
          {redeemUrl && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-soft">{t("batchRedeemHint", { url: redeemUrl })}</p>
          )}
          {/* Void stops unused codes; it cannot take back a granted seat and it
              is not a refund. Said here, not only in the confirm. */}
          {!batch.voided && <p className="mt-1.5 text-[11px] leading-relaxed text-soft">{t("batchVoidHint")}</p>}
        </>
      )}
      {confirming && (
        <ConfirmDialog
          title={t("batchVoidConfirmTitle")}
          body={t("batchVoidConfirmBody")}
          confirmLabel={t("batchVoid")}
          confirmDisabled={busy}
          onConfirm={() => {
            setBusy(true);
            void voidBatch({ batchId: batch.batchId }).finally(() => {
              setBusy(false);
              setConfirming(false);
            });
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </li>
  );
}

// One Organisation Voucher: who it was sold to, how full it is, what it has run
// up, the URL to hand out, and the two controls that change the deal.
function AccessCodeRow({ code }: { code: FunctionReturnType<typeof api.accessCodes.myAccessCodes>[number] }) {
  const t = useTranslations("Editions");
  const raise = useMutation(api.accessCodes.raiseCapacity);
  const stop = useMutation(api.accessCodes.stopCode);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [raising, setRaising] = useState(false);
  const [newCap, setNewCap] = useState("");
  // Both writes have real server-side refusals a Seller can hit by accident:
  // lowering the cap below the seats taken, and stopping an already-stopped
  // code. Swallowing them left the Seller staring at an unchanged number.
  const [error, setError] = useState<string | null>(null);
  // Read after mount; `window` does not exist on the server. The CURRENT host
  // on purpose: `/join` is served on every host.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  // The param is `voucher`, never `code`: Convex Auth's middleware claims any
  // `?code=` on an HTML GET as an OAuth code exchange and strips it in a
  // redirect (see join/page.tsx).
  const joinUrl = origin ? `${origin}/join?voucher=${code.code}` : "";
  const stopped = code.stoppedAt !== null;
  const [copied, setCopied] = useState<"code" | "url" | null>(null);
  const copy = (what: "code" | "url", text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(what);
        setTimeout(() => setCopied(null), 1500);
      },
      () => {
        /* clipboard blocked; the text is on screen to copy by hand */
      },
    );
  };

  return (
    <li className={`rounded-lg border px-3 py-2.5 ${stopped ? "border-line bg-hi/40" : "border-line bg-hi"}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <b className="block truncate text-[13px] font-semibold text-ink">{code.orgName}</b>
          <span className="text-[11.5px] text-soft">
            {t("accessTakeUp", { taken: code.taken, capacity: code.capacity })} ·{" "}
            {formatPrice(code.runningTotal, "ZAR")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {stopped && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-danger">
              {t("accessStoppedBadge")}
            </span>
          )}
          <Icon name="chevron" className={`h-4 w-4 shrink-0 text-soft transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <>
          {/* The code and the URL, in full and copyable. The Seller is the only
              person who can tell the organisation where to type it. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="font-mono text-[13px] font-semibold tracking-widest text-ink">{code.code}</p>
            <button
              type="button"
              onClick={() => copy("code", code.code)}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10.5px] font-medium text-soft transition-colors hover:border-accent hover:text-accent"
            >
              {copied === "code" ? t("copied") : t("copy")}
            </button>
          </div>
          {joinUrl && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="min-w-0 break-all text-[11px] leading-relaxed text-soft">{joinUrl}</p>
              <button
                type="button"
                onClick={() => copy("url", joinUrl)}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10.5px] font-medium text-soft transition-colors hover:border-accent hover:text-accent"
              >
                <Icon name="link" className="h-3 w-3" /> {copied === "url" ? t("copied") : t("copy")}
              </button>
            </div>
          )}
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-soft">
            {t("accessPerSeat", { price: formatPrice(code.pricePerSeat, "ZAR") })}
          </p>

          {/* A full sentence, not a status word: a Seller looking at an
              unsettled code should understand why their share is not payable. */}
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-soft">
            {stopped
              ? code.paymentRef
                ? t("accessPaymentLogged", {
                    reference: code.paymentRef,
                    seats: code.taken,
                    total: formatPrice(code.runningTotal, "ZAR"),
                  })
                : t("accessAwaitingPayment", { seats: code.taken, total: formatPrice(code.runningTotal, "ZAR") })
              : t("accessLiveHint")}
          </p>

          {/* Absent on a stopped code rather than disabled: there is no restart,
              and a greyed-out button invites a hunt for what would re-enable it. */}
          {!stopped && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRaising((r) => !r);
                  setNewCap(String(code.capacity));
                }}
                className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {t("accessRaise")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium text-soft transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
              >
                {t("accessStop")}
              </button>
            </div>
          )}

          {raising && !stopped && (
            <form
              className="mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const next = Number(newCap);
                if (!Number.isInteger(next) || next < 1) return;
                setBusy(true);
                setError(null);
                void raise({ accessCodeId: code.accessCodeId, capacity: next })
                  .then(() => setRaising(false))
                  .catch(() => setError(t("accessRaiseError", { taken: code.taken })))
                  .finally(() => setBusy(false));
              }}
            >
              <input
                value={newCap}
                inputMode="numeric"
                onChange={(e) => setNewCap(e.target.value)}
                className="w-24 rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-accent px-3 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
              >
                {t("accessRaiseSave")}
              </button>
              {/* Why the number cannot go down past the count: those seats exist
                  and their access is permanent. */}
              <span className="text-[11px] text-soft">{t("accessRaiseHint", { taken: code.taken })}</span>
            </form>
          )}

          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        </>
      )}

      {confirming && (
        <ConfirmDialog
          title={t("accessStopConfirmTitle")}
          // Three plain sentences, because a Seller must never mistake stopping
          // for a refund: it BILLS the organisation for the seats taken, the
          // seats already taken keep working, and it cannot be undone.
          body={t("accessStopConfirmBody", {
            seats: code.taken,
            total: formatPrice(code.runningTotal, "ZAR"),
            org: code.orgName,
          })}
          confirmLabel={t("accessStop")}
          confirmDisabled={busy}
          onConfirm={() => {
            setBusy(true);
            setError(null);
            void stop({ accessCodeId: code.accessCodeId })
              .catch(() => setError(t("accessStopError")))
              .finally(() => {
                setBusy(false);
                setConfirming(false);
              });
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
