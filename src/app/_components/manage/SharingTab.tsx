"use client";

import { useAction, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { type FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { LANGUAGES } from "../../../../convex/languages";
import { Icon, type IconName } from "../icons";
import { toMajor } from "~/lib/money";
import { useMutationRun } from "../mutationRun";
import { formatPrice } from "../Paygate";
import { ConfirmDialog } from "../ui";
import { EmptyPanel, Sheet, type Edition, type Engine } from "./shared";
import { VoucherCard } from "./VoucherCard";

// ── WhatsApp Row & Switch Components ────────────────────────────────────────

function WhatsAppToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-6 w-10.5 rounded-full bg-line transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] motion-reduce:after:transition-none peer-checked:bg-accent2 ltr:peer-checked:after:translate-x-4.5 rtl:peer-checked:after:-translate-x-4.5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
    </label>
  );
}

function WhatsAppRow({
  icon,
  iconColor = "text-soft",
  title,
  subtitle,
  right,
  onClick,
  danger = false,
  className = "",
}: {
  icon: IconName;
  iconColor?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex min-h-[54px] items-center gap-4 py-3 transition-colors ${
        onClick ? "cursor-pointer hover:bg-hi/30 active:bg-hi/50 -mx-2 px-2 rounded-xl" : ""
      } ${className}`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center ${
          danger ? "text-danger" : iconColor
        }`}
      >
        <Icon name={icon} className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div
          className={`text-[15px] leading-snug ${
            danger ? "font-medium text-danger" : "font-normal text-ink"
          }`}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[13px] leading-tight text-soft">
            {subtitle}
          </div>
        )}
      </div>

      {right && <div className="shrink-0 flex items-center">{right}</div>}
    </div>
  );
}

async function triggerDownloadQr(url: string, topicSlug: string, lang: string, notify: (msg: string) => void) {
  try {
    const QRCode = (await import("qrcode")).default;
    const png = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    const a = document.createElement("a");
    a.href = png;
    a.download = `${topicSlug}-${lang}-qr.png`;
    a.click();
    notify("QR code downloaded");
  } catch {
    notify("Could not generate QR code");
  }
}

// ── The Production SharingTab (Exact 3C Matching Image 1) ───────────────────

export function SharingTab({
  topicSlug,
  edition,
  completed,
  notify,
  onAddLanguage,
}: {
  topicSlug: string;
  edition: Edition;
  completed: boolean;
  notify: (message: string) => void;
  onAddLanguage: (() => void) | null;
}) {
  const t = useTranslations("Editions");
  const publish = useMutationRun(useMutation(api.shares.setEditionPublic), "Couldn't update link");
  const catalogue = useMutationRun(useMutation(api.catalogue.setEditionPublished), "Couldn't update catalog");
  const retranslate = useMutationRun(useAction(api.translate.startTranslation), t("updateError"));
  const shareTopic = useMutation(api.shares.shareTopic);
  // Kept the confirm open on refusal but said nothing about why; the refusal
  // now renders under the body.
  const removeEdition = useMutationRun(useMutation(api.translate.removeEdition), t("updateError"));

  const pricing = useQuery(api.market.editionPricing, { topicSlug });
  // Who the two nudges would reach on THIS Edition. Counts only, owner-only.
  const audience = useQuery(api.nudges.nudgeAudience, { topicSlug });
  const remindNotStarted = useMutationRun(
    useMutation(api.nudges.remindNotStarted),
    "Couldn't send the reminders",
  );
  const remindTranslators = useMutationRun(
    useMutation(api.nudges.remindPendingTranslators),
    "Couldn't send the reminders",
  );
  const sellerStatus = useQuery(api.sellers.sellerStatus);
  const currentPricing = pricing?.find((p) => p.lang === edition.lang) ?? null;

  const [copied, setCopied] = useState(false);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busyInvite, setBusyInvite] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const [pricingSheetOpen, setPricingSheetOpen] = useState(false);
  const [sellerSetupOpen, setSellerSetupOpen] = useState(false);
  const [vouchersSheetOpen, setVouchersSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmRetranslate, setConfirmRetranslate] = useState(false);
  const [confirmNudge, setConfirmNudge] = useState<null | "buyers" | "translators">(null);
  const [retranslateEngine, setRetranslateEngine] = useState<Engine>(edition.engine);

  // Optimistic toggle states for responsive UX without layout snap or lag
  const [localPublic, setLocalPublic] = useState<boolean | null>(null);
  const [localPublished, setLocalPublished] = useState<boolean | null>(null);

  const on = localPublic ?? (edition.publicToken != null);
  const isPublished = localPublished ?? edition.published;

  useEffect(() => {
    if (localPublic !== null && (edition.publicToken != null) === localPublic) {
      setLocalPublic(null);
    }
  }, [edition.publicToken, localPublic]);

  useEffect(() => {
    if (localPublished !== null && edition.published === localPublished) {
      setLocalPublished(null);
    }
  }, [edition.published, localPublished]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const effectiveToken = localPublic === false ? null : (edition.publicToken ?? null);
  const url = effectiveToken ? `${origin}/share/${effectiveToken}` : null;

  // Translating state
  if (edition.status === "translating") {
    const pct = edition.total > 0 ? Math.round((edition.done / edition.total) * 100) : 0;
    return (
      <div className="flex flex-col items-start gap-3.5 rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-soft">
        <p className="m-0">
          {t.rich("translatingProgress", {
            native: edition.name,
            done: edition.done,
            total: edition.total,
            b: (chunks) => <b className="font-semibold text-ink">{chunks}</b>,
          })}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          {/* scaleX, not width (fluid-interface 05): a compositor-only property,
              stepped under reduced motion. The track's `overflow-hidden
              rounded-full` shapes the fill, so the fill drops its own radius
              rather than have the scale squash it into an ellipse. */}
          <div
            className="h-full w-full origin-left bg-accent2 transition-transform duration-300 motion-reduce:transition-none rtl:origin-right"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
        <RemoveEdition topicSlug={topicSlug} lang={edition.lang} />
      </div>
    );
  }

  // Failed state
  if (edition.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3.5 rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-soft">
        <p className="m-0">
          {t.rich("failedMessage", {
            native: edition.name,
            b: (chunks) => <b className="font-semibold text-ink">{chunks}</b>,
          })}
        </p>
        <div className="flex items-center gap-3">
          <RetryTranslation topicSlug={topicSlug} lang={edition.lang} />
          <RemoveEdition topicSlug={topicSlug} lang={edition.lang} />
        </div>
      </div>
    );
  }

  const handleCopyLink = async () => {
    let linkUrl = url;
    if (!linkUrl) {
      setLocalPublic(true);
      const token = await publish.run({ topicSlug, lang: edition.lang, isPublic: true });
      if (token) {
        linkUrl = `${origin}/share/${token}`;
      } else {
        setLocalPublic(null);
        notify("Could not activate link");
        return;
      }
    }
    if (linkUrl) {
      void navigator.clipboard?.writeText(linkUrl).then(() => {
        setCopied(true);
        notify("Share link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleQrClick = () => {
    if (!url) {
      notify("Turn on public link sharing first");
      return;
    }
    void triggerDownloadQr(url, topicSlug, edition.lang, notify);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    setBusyInvite(true);
    setInviteMsg(null);
    try {
      const res = await shareTopic({ topicSlug, email: addr, lang: edition.lang });
      setInviteMsg(res === "shared" ? `Access granted to ${addr}` : `Invite sent to ${addr}`);
      setEmail("");
    } catch {
      setInviteMsg("Failed to send invite");
    } finally {
      setBusyInvite(false);
    }
  };

  return (
    <div className="flex flex-col pb-24 text-ink">
      {/* ── Top Hero Quick Actions Card (Exactly as in Image 1) ── */}
      <div className="my-2 flex items-center justify-center gap-4 rounded-3xl bg-card border border-line/70 p-5 shadow-xs">
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex w-20 flex-col items-center gap-2 text-xs font-normal text-ink transition-opacity hover:opacity-80"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent2/15 text-accent2">
            <Icon name="link" className="h-5 w-5" />
          </span>
          <span className="w-full text-center" aria-live="polite">
            <span className="inline-block w-full text-center">{copied ? "Copied!" : "Copy link"}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={handleQrClick}
          className="flex w-20 flex-col items-center gap-2 text-xs font-normal text-ink transition-opacity hover:opacity-80"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Icon name="qr" className="h-5 w-5" />
          </span>
          <span className="w-full truncate text-center">QR code</span>
        </button>

        <button
          type="button"
          onClick={() => setInviteSheetOpen(true)}
          className="flex w-20 flex-col items-center gap-2 text-xs font-normal text-ink transition-opacity hover:opacity-80"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Icon name="users" className="h-5 w-5" />
          </span>
          <span className="w-full truncate text-center">Email invite</span>
        </button>

        {/* Printable poster: only when completed & active */}
        {completed && on && url && (
          <a
            href={`/poster/${edition.publicToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fade-in-item flex w-20 flex-col items-center gap-2 text-xs font-normal text-ink transition-opacity hover:opacity-80"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Icon name="poster" className="h-5 w-5" />
            </span>
            <span className="w-full truncate text-center">Poster</span>
          </a>
        )}
      </div>

      {/* ── Section 1: Sharing settings (Exactly as in Image 1) ── */}
      <h3 className="px-1 pt-4 pb-1 text-[13px] font-normal text-soft">
        Sharing settings
      </h3>

      <WhatsAppRow
        icon="link"
        title="Public link sharing"
        subtitle={on ? "Anyone with this link can view this course" : "Public link is disabled"}
        right={
          <WhatsAppToggle
            checked={on}
            disabled={publish.busy}
            onChange={(next) => {
              setLocalPublic(next);
              void publish.run({ topicSlug, lang: edition.lang, isPublic: next }).then((res) => {
                if (res === undefined) {
                  setLocalPublic(null);
                }
              });
            }}
          />
        }
      />

      <WhatsAppRow
        icon="globe"
        title="Show in Site Catalog"
        subtitle={isPublished ? "Listed in site catalog" : "Hidden from site catalog"}
        right={
          <WhatsAppToggle
            checked={isPublished}
            disabled={catalogue.busy}
            onChange={(next) => {
              setLocalPublished(next);
              void catalogue.run({ topicSlug, lang: edition.lang, published: next }).then((res) => {
                if (res === undefined) {
                  setLocalPublished(null);
                }
              });
            }}
          />
        }
      />

      {/* Regenerate link: only surfaced when the public link is active — it
          invalidates every existing share URL, so it's a deliberate secondary
          action, not something to stumble onto. */}
      {on && (
        <div className="fade-in-item mb-1 flex justify-end px-1">
          <button
            type="button"
            onClick={() => setConfirmRegenerate(true)}
            className="text-[12px] text-soft transition-colors hover:text-accent"
          >
            Regenerate link
          </button>
        </div>
      )}

      {/* ── Section 2: Monetization and licensing (Exactly as in Image 1) ── */}
      <h3 className="px-1 pt-6 pb-1 text-[13px] font-normal text-soft">
        Monetization and licensing
      </h3>

      <WhatsAppRow
        icon="tag"
        title="Course Pricing"
        subtitle={
          !completed
            ? "Paid enrollment unlocks once curriculum authoring is marked complete."
            : sellerStatus !== "ready"
              ? "Set up payout details to charge for this course"
              : currentPricing
                ? `Priced at ${formatPrice(currentPricing.amount, currentPricing.currency)}`
                : "Free to access"
        }
        onClick={
          completed
            ? sellerStatus !== "ready"
              ? () => setSellerSetupOpen(true)
              : () => setPricingSheetOpen(true)
            : undefined
        }
        right={
          <span className="rounded-full bg-gold/15 px-3 py-0.5 text-xs font-medium text-gold">
            {currentPricing ? formatPrice(currentPricing.amount, currentPricing.currency) : "Free"}
          </span>
        }
      />

      <WhatsAppRow
        icon="award"
        title="Group & Organisation Vouchers"
        subtitle={
          !completed
            ? "Voucher issuance unlocks once curriculum authoring is marked complete."
            : sellerStatus !== "ready"
              ? "Set up payout details to issue vouchers"
              : "Manage shared organisation codes or individual batch vouchers."
        }
        onClick={
          completed
            ? sellerStatus !== "ready"
              ? () => setSellerSetupOpen(true)
              : () => setVouchersSheetOpen(true)
            : undefined
        }
        right={completed ? <Icon name="chevron" className="h-4 w-4 text-soft" /> : null}
      />

      {/* Nudges: the two manual re-sends. Both are owner-pressed and confirmed,
          never scheduled, so nobody is mailed without the owner deciding to.
          Their audience is the WHOLE COURSE, every language, not the Edition
          this tab is showing: the operator sits on the English source, where
          nobody is invited to translate, so a per-Edition count read zero while
          the Dashboard listed the people by name. Each recipient is mailed at
          their own Edition instead. "Not started" is the Dashboard's own bucket,
          zero lessons completed, read from the same walk so the two tabs cannot
          print different numbers for the same people. A row with nobody to reach
          stays inert rather than disappearing, so an empty audience is visible. */}
      <h3 className="px-1 pt-6 pb-1 text-[13px] font-normal text-soft">Reminders</h3>

      <WhatsAppRow
        icon="mail"
        title="Remind learners who never started"
        subtitle={
          audience === undefined
            ? "Counting who has completed no lessons yet"
            : audience.truncated
              ? "Too much progress data on this course to count the audience"
              : audience.notStarted === 0
                ? "Everyone on this course has completed at least one lesson"
                : `Email the ${audience.notStarted} in the Dashboard's Not started, across all languages`
        }
        onClick={audience && audience.notStarted > 0 ? () => setConfirmNudge("buyers") : undefined}
        right={audience && audience.notStarted > 0 ? <Icon name="chevron" className="h-4 w-4 text-soft" /> : null}
      />

      <WhatsAppRow
        icon="edit"
        title="Nudge invited translators"
        subtitle={
          audience === undefined
            ? "Counting invited translators without an account"
            : audience.translators === 0
              ? "Every invited translator has an account"
              : `Email ${audience.translators} invited ${audience.translators === 1 ? "translator" : "translators"} to create an account, each linked to their own language`
        }
        onClick={audience && audience.translators > 0 ? () => setConfirmNudge("translators") : undefined}
        right={audience && audience.translators > 0 ? <Icon name="chevron" className="h-4 w-4 text-soft" /> : null}
      />

      {/* ── Section 3: Danger Zone (if not source language) ── */}
      {!edition.source && (
        <div className="mt-6 border-t border-line/40 pt-2">
          <WhatsAppRow
            icon="refresh"
            title="Re-translate this edition"
            subtitle={`Re-run the ${edition.name} translation from scratch`}
            onClick={() => {
              setRetranslateEngine(edition.engine);
              setConfirmRetranslate(true);
            }}
          />
          <WhatsAppRow
            icon="trash"
            danger
            title="Delete Language Edition"
            subtitle={`Remove ${edition.name} translation and revoke share link`}
            onClick={() => setConfirmDelete(true)}
          />
        </div>
      )}

      {/* Add language button on single edition */}
      {onAddLanguage && (
        <div className="mt-4 px-1">
          <button
            type="button"
            onClick={onAddLanguage}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-[13px] font-medium text-soft transition-colors hover:bg-hi hover:text-accent"
          >
            <Icon name="plus" className="h-4 w-4" /> {t("addLanguage")}
          </button>
        </div>
      )}

      {/* ── Focused Modal Sheets for Email Invite, Pricing, and Vouchers ── */}
      {inviteSheetOpen && (
        <Sheet title="Invite to Course by Email" onClose={() => setInviteSheetOpen(false)}>
          <div className="flex flex-col gap-3 text-ink">
            <p className="text-xs text-soft">Send an invite link through email.</p>
            <form onSubmit={handleInviteSubmit} className="flex flex-col gap-2.5">
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setInviteMsg(null);
                }}
                placeholder="colleague@example.com"
                className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-soft/60 focus:border-accent2 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busyInvite || !email.trim()}
                className="rounded-xl bg-accent py-2 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-40"
              >
                {busyInvite ? "Sending…" : "Send invite"}
              </button>
            </form>
            {inviteMsg && <p className="text-xs text-accent2 font-medium">{inviteMsg}</p>}
          </div>
        </Sheet>
      )}

      {pricingSheetOpen && (
        <Sheet title="Course Pricing" onClose={() => setPricingSheetOpen(false)}>
          <div className="p-1">
            <PriceEditor
              topicSlug={topicSlug}
              lang={edition.lang}
              current={currentPricing}
              onSaved={() => setPricingSheetOpen(false)}
            />
          </div>
        </Sheet>
      )}

      {sellerSetupOpen && (
        <Sheet title={t("turnOnSellingTitle")} onClose={() => setSellerSetupOpen(false)}>
          <p className="text-[13px] leading-relaxed text-soft">
            <b className="font-semibold text-ink">{t("addPayoutTitle")}</b> {t("addPayoutBody")}
          </p>
          <PayoutDetailsForm />
        </Sheet>
      )}

      {vouchersSheetOpen && (
        <Sheet title="Group & Organisation Vouchers" onClose={() => setVouchersSheetOpen(false)}>
          <div className="pt-2">
            {sellerStatus !== "ready" ? (
              <div className="flex flex-col gap-3 p-1">
                <p className="text-[13px] leading-relaxed text-soft">
                  <b className="font-semibold text-ink">Payout details required.</b> Set up payout details before issuing vouchers.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setVouchersSheetOpen(false);
                    setSellerSetupOpen(true);
                  }}
                  className="rounded-xl bg-accent py-2 text-xs font-semibold text-white hover:bg-accent/90"
                >
                  Set up payout details
                </button>
              </div>
            ) : (
              <VoucherCard
                topicSlug={topicSlug}
                lang={edition.lang}
                name={edition.name}
                published={edition.published}
              />
            )}
          </div>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Remove ${edition.name} Edition?`}
          body="All translated lessons and its public share link will be deleted permanently."
          extra={removeEdition.error ? <p className="text-xs text-danger">{removeEdition.error}</p> : undefined}
          confirmLabel={removeEdition.busy ? "Deleting…" : "Delete Edition"}
          confirmDisabled={removeEdition.busy}
          onConfirm={() => {
            void removeEdition.run({ topicSlug, lang: edition.lang }).then((ok) => {
              if (ok !== undefined) setConfirmDelete(false);
            });
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {confirmRegenerate && (
        <ConfirmDialog
          title="Regenerate share link?"
          body="The current link will stop working immediately. Anyone who saved it will need the new one."
          confirmLabel={publish.busy ? "Regenerating…" : "Regenerate"}
          confirmDisabled={publish.busy}
          onConfirm={() => {
            void publish
              .run({ topicSlug, lang: edition.lang, isPublic: true })
              .then((ok) => ok !== undefined && setConfirmRegenerate(false));
          }}
          onClose={() => setConfirmRegenerate(false)}
        />
      )}

      {confirmNudge === "buyers" && (
        <ConfirmDialog
          title="Send the reminder?"
          body={`${audience?.notStarted ?? 0} ${audience?.notStarted === 1 ? "person has" : "people have"} completed no lessons on this course, in any language. That is the Dashboard's Not started. Each gets one email, linking straight into the edition they hold.`}
          extra={remindNotStarted.error ? <p className="text-xs text-danger">{remindNotStarted.error}</p> : undefined}
          confirmLabel={remindNotStarted.busy ? "Sending…" : "Send reminder"}
          confirmDisabled={remindNotStarted.busy}
          onConfirm={() => {
            void remindNotStarted.run({ topicSlug }).then((sent) => {
              if (sent === undefined) return;
              setConfirmNudge(null);
              notify(sent === 1 ? "Reminder sent to 1 learner" : `Reminder sent to ${sent} learners`);
            });
          }}
          onClose={() => setConfirmNudge(null)}
        />
      )}

      {confirmNudge === "translators" && (
        <ConfirmDialog
          title="Nudge the translators?"
          body={`${audience?.translators ?? 0} invited ${audience?.translators === 1 ? "translator has" : "translators have"} no account yet, across every language of this course. Each gets one email asking them to create one, linked straight to the edition they were invited to edit.`}
          extra={remindTranslators.error ? <p className="text-xs text-danger">{remindTranslators.error}</p> : undefined}
          confirmLabel={remindTranslators.busy ? "Sending…" : "Send nudge"}
          confirmDisabled={remindTranslators.busy}
          onConfirm={() => {
            void remindTranslators.run({ topicSlug }).then((sent) => {
              if (sent === undefined) return;
              setConfirmNudge(null);
              notify(sent === 1 ? "Nudge sent to 1 translator" : `Nudge sent to ${sent} translators`);
            });
          }}
          onClose={() => setConfirmNudge(null)}
        />
      )}

      {confirmRetranslate && (
        <ConfirmDialog
          title={`Re-translate ${edition.name}?`}
          body={`All existing translated lessons will be replaced. This cannot be undone.`}
          extra={<EngineToggle value={retranslateEngine} onChange={setRetranslateEngine} disabled={retranslate.busy} />}
          confirmLabel={retranslate.busy ? "Starting…" : "Re-translate"}
          confirmDisabled={retranslate.busy}
          onConfirm={() => {
            void retranslate
              .run({ topicSlug, lang: edition.lang, engine: retranslateEngine })
              .then((ok) => ok !== undefined && setConfirmRetranslate(false));
          }}
          onClose={() => setConfirmRetranslate(false)}
        />
      )}
    </div>
  );
}

// ── Price Editor ────────────────────────────────────────────────────────────

type Pricing = FunctionReturnType<typeof api.market.editionPricing>[number];

function PriceEditor({
  topicSlug,
  lang,
  current,
  onSaved,
}: {
  topicSlug: string;
  lang: string;
  current: Pricing | null;
  onSaved: () => void;
}) {
  const t = useTranslations("Editions");
  const setPrice = useMutation(api.market.setEditionPrice);
  const clearPrice = useMutation(api.market.clearEditionPrice);
  const major = (minor: number | undefined) => (minor === undefined ? "" : toMajor(minor).toFixed(2));
  const [amount, setAmount] = useState(current ? toMajor(current.amount).toFixed(2) : "");
  const [usd, setUsd] = useState(major(current?.usdAmount));
  const [eur, setEur] = useState(major(current?.eurAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const minor = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) {
      setError(t("priceGreaterThanZero"));
      return;
    }
    const regional = (raw: string): number | undefined | "bad" => {
      if (!raw.trim()) return undefined;
      const cents = Math.round(parseFloat(raw) * 100);
      return Number.isFinite(cents) && cents > 0 ? cents : "bad";
    };
    const usdAmount = regional(usd);
    const eurAmount = regional(eur);
    if (usdAmount === "bad" || eurAmount === "bad") {
      setError(t("priceGreaterThanZero"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setPrice({ topicSlug, lang, amount: minor, currency: "ZAR", usdAmount, eurAmount });
      onSaved();
    } catch {
      setError(t("savePriceError"));
    } finally {
      setBusy(false);
    }
  };

  const stopSelling = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearPrice({ topicSlug, lang });
      onSaved();
    } catch {
      setError(t("updateError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2.5">
        {(
          [
            [t("priceZar"), amount, setAmount],
            [t("priceUsd"), usd, setUsd],
            [t("priceEur"), eur, setEur],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{label}</span>
            <input
              value={value}
              inputMode="decimal"
              onChange={(e) => {
                set(e.target.value);
                setError(null);
              }}
              placeholder={t("pricePlaceholder")}
              className="w-24 rounded-lg border border-line bg-card px-3 py-2 text-sm tabular-nums focus:border-gold focus:outline-none sm:w-32"
            />
          </label>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? t("saving") : t("save")}
        </button>
      </div>
      <p className="text-xs text-soft">{t("regionalPriceHint")}</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      {current && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void stopSelling()}
          className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-soft transition-colors hover:text-danger disabled:opacity-60"
        >
          <Icon name="x" className="h-3.75 w-3.75" /> {t("stopSelling")}
        </button>
      )}
    </div>
  );
}

// ── Payout Details Form ─────────────────────────────────────────────────────

function PayoutDetailsForm() {
  const t = useTranslations("Editions");
  const save = useMutation(api.sellers.savePayoutDetails);
  const [form, setForm] = useState({ accountHolder: "", bank: "", accountNumber: "", branchCode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = (key: keyof typeof form, label: string, placeholder: string, inputMode?: "numeric") => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{label}</span>
      <input
        value={form[key]}
        inputMode={inputMode}
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
      className="mt-2.5 flex flex-col gap-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await save(form);
        } catch {
          setError(t("payoutSaveError"));
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {field("accountHolder", t("accountHolder"), t("accountHolderPlaceholder"))}
        {field("bank", t("bank"), t("bankPlaceholder"))}
        {field("accountNumber", t("accountNumber"), t("accountNumberPlaceholder"), "numeric")}
        {field("branchCode", t("branchCode"), t("branchCodePlaceholder"), "numeric")}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {busy ? t("saving") : t("savePayoutDetails")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// ── Retry and Remove ────────────────────────────────────────────────────────

function RetryTranslation({ topicSlug, lang }: { topicSlug: string; lang: string }) {
  const t = useTranslations("Editions");
  const { run, busy, error } = useMutationRun(useAction(api.translate.startTranslation), t("updateError"));
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({ topicSlug, lang })}
        className="inline-flex items-center gap-2 self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        <Icon name="refresh" className="h-4 w-4" /> {busy ? t("retrying") : t("retry")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function RemoveEdition({ topicSlug, lang, label }: { topicSlug: string; lang: string; label?: string }) {
  const t = useTranslations("Editions");
  const { run, busy, error } = useMutationRun(useMutation(api.translate.removeEdition), t("updateError"));
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({ topicSlug, lang })}
        className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-soft transition-colors hover:text-danger disabled:opacity-60"
      >
        <Icon name="trash" className="h-3.75 w-3.75" /> {label ?? t("remove")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function EngineToggle({ value, onChange, disabled }: { value: Engine; onChange: (e: Engine) => void; disabled?: boolean }) {
  const t = useTranslations("Editions");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("engineLabel")}</span>
      <div className="inline-flex self-start overflow-hidden rounded-lg border border-line text-[12.5px]">
        {(["free", "gemini"] as const).map((eng) => (
          <button
            key={eng}
            type="button"
            disabled={disabled}
            aria-pressed={value === eng}
            onClick={() => onChange(eng)}
            className={`px-3 py-1.5 font-medium transition-colors disabled:opacity-60 ${
              value === eng ? "bg-accent text-white" : "bg-card text-soft hover:bg-hi"
            }`}
          >
            {eng === "free" ? t("engineFree") : t("engineGemini")}
          </button>
        ))}
      </div>
      <span className="text-[11.5px] text-soft">{value === "gemini" ? t("engineGeminiWarn") : t("engineFreeHint")}</span>
    </div>
  );
}

// ── AddLanguagePanel (Used by ManageShell) ──────────────────────────────────

export function AddLanguagePanel({
  topicSlug,
  editions,
  completed,
  onAdded,
}: {
  topicSlug: string;
  editions: Edition[];
  completed: boolean;
  onAdded: (code: string) => void;
}) {
  const t = useTranslations("Editions");
  const { run, busy, error } = useMutationRun(useAction(api.translate.startTranslation), t("updateError"));
  const [q, setQ] = useState("");
  const [engine, setEngine] = useState<Engine>("free");

  if (!completed) {
    return <EmptyPanel icon="lock" tone="soft" message={t("translationLocked")} />;
  }

  const present = new Set(editions.map((e) => e.lang));
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? LANGUAGES.filter(
        (l) =>
          !present.has(l.code) &&
          (l.name.toLowerCase().includes(needle) ||
            l.native.toLowerCase().includes(needle) ||
            l.code.toLowerCase().includes(needle)),
      ).slice(0, 8)
    : LANGUAGES.filter((l) => !present.has(l.code) && l.code !== "en").slice(0, 8);

  const add = (code: string) => {
    setQ("");
    void run({ topicSlug, lang: code, engine }).then((ok) => ok !== undefined && onAdded(code));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-soft">{t("addLanguageIntro")}</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      <EngineToggle value={engine} onChange={setEngine} disabled={busy} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={busy}
        placeholder={t("searchLanguages")}
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-60"
      />
      <div className="h-[290px] overflow-y-auto pe-0.5">
        {matches.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {matches.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => add(l.code)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-start text-sm text-ink transition-colors hover:bg-hi"
                >
                  <span className="min-w-0 truncate">{l.name}</span>
                  <span className="shrink-0 text-xs uppercase text-soft">
                    {l.code}
                    {l.rtl ? t("rtlSuffix") : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : needle ? (
          <p className="py-2 text-xs text-soft">{t("noMatchingLanguage")}</p>
        ) : (
          <p className="py-2 text-xs text-soft">{t("allLanguagesTranslated")}</p>
        )}
      </div>
    </div>
  );
}
