"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { ConfirmDialog } from "./ui";

// What a member holding a **Seat** on a shared Access Code sees in Settings (ADR
// 0031, shared-access-codes tickets 10 and 11): who they are on this rail, and the
// withdrawal. (The PIN change went with the PIN itself on 2026-08-27: a Seat now
// signs in by name alone, so there is no second credential to manage here.)
//
// **It renders nothing at all unless the caller holds a Seat.** `accessCodes.mySeat`
// returns null for a Guest and null for an ordinary email-and-password account, so
// the controls are absent by server answer rather than hidden by this component's
// judgement. That also means it is safe to mount unconditionally.
//
// **This is the one surface that shows a nickname, and it shows it only to the person
// who chose it.** `mySeat` is scoped to `getAuthUserId` and takes no argument, so
// there is nothing a caller could pass to ask about somebody else.
export function SeatSettings() {
  const t = useTranslations("Settings");
  const seat = useQuery(api.accessCodes.mySeat);
  if (!seat) return null;
  return (
    <>
      <p className="px-1 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-accent2">{t("seatSection")}</p>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between gap-3 px-3 py-3.5 text-sm">
          <span className="text-ink">{t("seatSignedInAs")}</span>
          <span className="min-w-0 truncate text-soft">{seat.nickname}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-3.5 text-sm">
          <span className="text-ink">{t("seatCourse")}</span>
          <span className="min-w-0 truncate text-soft">{seat.courseTitle}</span>
        </div>
        {/* The consent record shown back to the person it is about. It exists to
            discharge s11(2)'s burden of proof, and a record its subject cannot see is a
            worse record. */}
        <div className="flex items-center justify-between gap-3 px-3 py-3.5 text-sm">
          <span className="text-ink">{t("seatConsent")}</span>
          <span className="min-w-0 truncate text-soft">
            {t("seatConsentValue", {
              date: new Date(seat.consentedAt).toLocaleDateString(),
              version: seat.consentVersion,
            })}
          </span>
        </div>
        <AddEmail hasEmail={seat.hasEmail} />
        <DeleteSeat />
      </div>
    </>
  );
}

// **Add an email and a password to a Seat**, so a member can sign in either way
// afterwards (asked for on 2026-08-25; ADR 0031's addendum records the reversal).
//
// Two things about it are not obvious and both are deliberate.
//
// **It is opt-in and it stays opt-in.** The whole rail exists because this audience
// would not push through an email sign-up, and a real name or address beside a
// political party's cohort is the thing POPIA makes hardest to hold. So nothing asks
// for this, nothing nags, and a member who never touches it is never worse off. What
// it buys them is a second door that does not depend on the code: a way in if the
// organisation's code is ever forgotten or mislaid.
//
// Password only. Google cannot do this: its callback is an httpAction with no Convex
// identity, so the adoption branch in `convex/auth.ts` has nothing to adopt onto.
function AddEmail({ hasEmail }: { hasEmail: boolean }) {
  const t = useTranslations("Settings");
  const { signIn } = useAuthActions();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already done: say so and stop. There is no "change my email" here, because that
  // is the ordinary account's problem and this row is about gaining a second way in,
  // not managing it.
  if (hasEmail) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-3.5 text-sm">
        <span className="text-ink">{t("emailLinked")}</span>
        <span className="text-soft">{t("emailLinkedYes")}</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between px-3 py-3.5 text-left text-sm text-ink active:bg-hi"
      >
        <span>{t("emailAdd")}</span>
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 px-3 py-3.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          // The ordinary Password sign-UP flow, run while already signed in as the
          // Seat. `createOrUpdateUser` sees a signed-in row with no email and adopts
          // it rather than inserting a second one; see the guard there for why that is
          // safe. A taken address falls through to a new account, which would sign the
          // member out of their Seat, so the address is checked server-side there and
          // the failure surfaces here.
          await signIn("password", { email, password, flow: "signUp" });
        } catch {
          setError(t("emailAddFailed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-xs leading-relaxed text-soft">{t("emailAddWhy")}</p>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-soft">{t("emailAddEmail")}</span>
        <input
          value={email}
          type="email"
          autoComplete="email"
          required
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-soft">{t("emailAddPassword")}</span>
        <input
          value={password}
          type="password"
          autoComplete="new-password"
          required
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !email || password.length < 8}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {busy ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-soft"
        >
          {t("cancel")}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

// The POPIA s11 withdrawal. s27(1)(a) consent is the entire legal basis for this rail,
// so a withdrawal right that cannot be exercised is not a right.
//
// **The confirm has to say the one thing a member would not guess**, and it is not
// the deletion: it is that the credential goes with the link. The nickname and PIN ARE
// the personal link, so deleting the link deletes the way back in. They keep the
// course on the device they are holding, for as long as this sign-in lasts, and they
// cannot sign in again anywhere else. A member who was not told that will reasonably
// believe they can come back.
function DeleteSeat() {
  const t = useTranslations("Settings");
  const deleteSeat = useMutation(api.accessCodes.deleteMySeat);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="flex w-full items-center justify-between px-3 py-3.5 text-left text-sm text-danger active:bg-hi"
      >
        <span>{t("seatDelete")}</span>
      </button>
      {confirming && (
        <ConfirmDialog
          title={t("seatDeleteConfirmTitle")}
          body={t("seatDeleteConfirmBody")}
          confirmLabel={t("seatDelete")}
          confirmDisabled={busy}
          onConfirm={() => {
            setBusy(true);
            void deleteSeat({}).finally(() => {
              setBusy(false);
              setConfirming(false);
            });
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

