"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { normaliseAccessCode } from "../../../convex/accessCodeFormat";
import { CONSENT_VERSION } from "../../../convex/joinConsent";
import { armInstallPrompt } from "./accountLocalState";
import { withLang } from "./editionUrl";

// The `/join` journey (ADR 0031, shared-access-codes ticket 05). Where a stranger
// with a code meets the product, and the only page on the platform walked by
// somebody who has no account, will never be asked for an email, and was handed a
// code in a WhatsApp group with little explanation. Everything upstream is worthless
// if this loses them.
//
// `/redeem` is the prior art for every structural decision in it, with one
// difference that changes the shape completely: redemption is auth-first and has to
// send a stranger through sign-up mid-flow, so `RedeemPanel` is built around not
// losing the code across that boundary. **There is no boundary here.** The form IS
// the sign-up, so there is no round trip, no localStorage stash and no OAuth hop to
// survive. That absence is the feature.
//
// **Stripped to the bone on 2026-08-27, by the owner's explicit call, in two
// passes**: first the blurb, the field hints and the "we do not track you" half of
// the consent sentence went; then the PIN itself and the new/returning toggle. What
// is left is one box, the member's name and surname, and one button: the server
// signs a known name back into its seat and takes a new seat for an unknown one
// (`convex/accessCodeAuth.ts`). The hints this page used to carry were treated as
// POPIA compliance controls when they shipped (the real-name mitigation and the
// no-PIN-reset warning); the owner judged the ceremony was losing the audience it
// existed to protect and chose the simple form, real names included. The consent
// record was re-versioned (see `convex/joinConsent.ts`, "2026-08-27") rather than
// silently rewritten.
//
// **Consent is the act of joining** (2026-08-26): one sentence stated directly above
// the button that does it, the way the sign-in page states its terms agreement. It was
// a separate agree/refuse step until the wording had been shortened twice and the step
// itself was still judged too heavy for somebody standing in a room with a phone.
//
// That is materially weaker than a separate step and it is worth knowing why it is
// still defensible: POPIA wants a "voluntary, specific and informed expression of
// will", pressing a button under a sentence that names what is kept IS a clear
// affirmative action, the Terms carry the full undertaking one tap away, and the
// version and timestamp are still stored per Seat and still refused server-side. See
// `convex/joinConsent.ts` for the full reasoning and for the one thing to put in front
// of a legal opinion first.

// Two steps now, and a code that arrived on a link skips the first.
//
// **There used to be a third, a consent step in front of both** (an agree/refuse
// screen, then three short lines). It went on 2026-08-26: consent is now the act of
// joining, stated in one sentence directly above the button that does it, the way the
// sign-in page states its terms agreement. See `convex/joinConsent.ts` for what that
// costs and what holds the line.
type Step = "code" | "identity";

export function JoinPanel({ linkedCode }: { linkedCode: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <AuthLoading>
        <div className="mt-6 h-40 animate-pulse rounded-2xl border border-line bg-card" />
      </AuthLoading>
      <Unauthenticated>
        <JoinFlow linkedCode={linkedCode} />
      </Unauthenticated>
      {/* Signed in already: either they have just joined (and go straight into the
          course) or they arrived holding a code on an account that already exists. */}
      <Authenticated>
        <AlreadyIn />
      </Authenticated>
    </div>
  );
}

function JoinFlow({ linkedCode }: { linkedCode: string }) {
  const t = useTranslations("Join");
  // **A code that arrived on the link skips the code step entirely.** Somebody who
  // followed `/join?voucher=...` has already handed the code over by clicking, so a box
  // asking them to confirm it is a step that exists only because the page could not
  // tell the two cases apart. `/redeem` learned the same lesson.
  const [step, setStep] = useState<Step>(linkedCode ? "identity" : "code");
  // Already normalised by the server component that read it. Nothing in this
  // component touches the URL: see `join/page.tsx` for why the read moved there.
  const [typedCode, setTypedCode] = useState("");
  const code = linkedCode || typedCode;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-accent">{t("title")}</h1>

      {step === "code" ? (
        <CodeStep code={typedCode} setCode={setTypedCode} onNext={() => setStep("identity")} />
      ) : (
        <Identity code={code} />
      )}
    </>
  );
}

// Step 1. Normalised as they type, so the thing on screen is the thing being looked
// up. It matters more here than on `/redeem`: this code was read out in a room or
// forwarded through three people, and a code that "does not exist" because of a
// stray space is indistinguishable to a stranger from a dud one.
function CodeStep({ code, setCode, onNext }: { code: string; setCode: (c: string) => void; onNext: () => void }) {
  const t = useTranslations("Join");
  return (
    <form
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const entered = normaliseAccessCode(code);
        if (!entered) return;
        setCode(entered);
        onNext();
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("codeLabel")}</span>
        <input
          value={code}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder={t("codePlaceholder")}
          onChange={(e) => setCode(normaliseAccessCode(e.target.value))}
          className="w-full rounded-lg border border-line bg-hi px-3 py-2.5 font-mono text-lg tracking-widest text-ink focus:border-gold focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={!code}
        className="rounded-lg bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {t("continue")}
      </button>
    </form>
  );
}

// Step 2. One box: the member's name (2026-08-27, the owner's call). The server
// signs the name into the seat it already holds on this code, or takes a new seat
// for it, so there is no new/returning choice and no PIN. The trade that buys this
// (the name is the whole credential) is recorded at `accessCodes.ts` ACCESS_ERRORS.
function Identity({ code }: { code: string }) {
  const t = useTranslations("Join");
  const { signIn } = useAuthActions();
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = nickname.trim().length > 0;

  return (
    <form
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        setBusy(true);
        setError(null);
        try {
          await signIn("accessCode", { code, nickname, consentVersion: CONSENT_VERSION });
          // **Arm the install sheet for the course screen they are about to land on.**
          // This member is the best install candidate on the platform and the one who
          // could never see the prompt: it lives on "/" and a join goes straight into
          // the reader. They arrived from a WhatsApp link on a phone and hold no email
          // and no password, so a home-screen icon is the only bookmark that survives
          // them closing the tab. Armed rather than shown here, because the sheet waits
          // 3s by design and this component is about to unmount.
          armInstallPrompt();
          // No navigation here. `AlreadyIn` takes over the moment the token lands and
          // sends them into the Edition, so success is never a screen with a button.
        } catch (err) {
          setError(messageFor(err, t));
          setBusy(false);
        }
      }}
    >
      {/* Say which code is being used, on the screen where a member who arrived by
          link has never seen it echoed back. Without this the page silently uses a
          code they cannot check, and "we do not recognise that code" arrives with
          nothing on screen to compare it against. */}
      <p className="text-[11.5px] leading-relaxed text-soft">
        {t("usingCode")} <b className="font-mono tracking-widest text-ink">{code}</b>
      </p>

      {/* The one thing asked for. `autoComplete="name"` so the phone offers the fill:
          the same name typed the same way is the way back into the same seat. */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("nicknameLabel")}</span>
        <input
          value={nickname}
          autoFocus
          autoComplete="name"
          spellCheck={false}
          placeholder={t("nicknamePlaceholder")}
          onChange={(e) => {
            setNickname(e.target.value);
            setError(null);
          }}
          className="w-full rounded-lg border border-line bg-hi px-3 py-2.5 text-base text-ink focus:border-gold focus:outline-none"
        />
      </label>

      {/* **The consent record, at the button that gives it.** One sentence since
          2026-08-27 (the owner cut the "we do not track you" detail as reading like a
          scam disclaimer); the Terms and Privacy Policy carry the full undertaking one
          tap away, and the version and timestamp are still stored on the Seat and still
          refused server-side. Its wording is pinned to `convex/joinConsent.ts` by
          `messages/consent.test.ts`: editing it here without minting a new version
          there fails a test, deliberately, because it would rewrite what already-joined
          members are recorded as having agreed to.

          Links open in a new tab so a member reading them does not lose the code they
          arrived with. */}
      <p className="text-[11.5px] leading-relaxed text-soft">
        {t.rich("agree", {
          terms: (c) => (
            <Link href="/terms" target="_blank" className="text-accent2 underline-offset-2 hover:underline">
              {c}
            </Link>
          ),
          privacy: (c) => (
            <Link href="/privacy" target="_blank" className="text-accent2 underline-offset-2 hover:underline">
              {c}
            </Link>
          ),
        })}
      </p>

      <button
        type="submit"
        disabled={busy || !ready}
        className="rounded-lg bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {busy ? t("working") : t("submitJoin")}
      </button>
      {/* Never an email field, anywhere on this page. The promise is visible in the
          product and not only in the policy. */}
      {error && <p className="text-sm leading-relaxed text-danger">{error}</p>}
    </form>
  );
}

// Signed in. A member who has just joined lands in the Edition rather than on a
// success message with nowhere to go: the seat is granted and permanent by this
// point, so a panel offering one more click was a dead end. `replace`, not `push`,
// so Back from the reader does not return to a join form.
//
// The other case is somebody who arrived at `/join` already signed in on an ordinary
// account. They are told, rather than being shown a form that would swap them out of
// their own account.
function AlreadyIn() {
  const t = useTranslations("Join");
  const seat = useQuery(api.accessCodes.mySeat);
  const router = useRouter();

  useEffect(() => {
    // The language is always explicit in the URL: left implicit, the reader can
    // resolve to a different free Edition of the same course.
    if (seat) router.replace(withLang(`/courses/${seat.topicSlug}`, seat.lang));
  }, [seat, router]);

  if (seat === undefined) return <div className="mt-6 h-32 animate-pulse rounded-2xl border border-line bg-card" />;

  if (seat === null) {
    return (
      <section className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-semibold text-ink">{t("alreadySignedInTitle")}</h2>
        <p className="text-sm leading-relaxed text-soft">{t("alreadySignedInBody")}</p>
        <Link
          href="/"
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          {t("alreadySignedInGo")}
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-gold/40 bg-card px-5 py-4">
      <b className="text-base font-semibold text-accent">{t("successTitle")}</b>
      <p className="text-sm leading-relaxed text-soft">{t("successBody", { course: seat.courseTitle })}</p>
      {/* A fallback, not the way through: the effect above is already navigating. It
          stays because a blocked or slow client-side replace would otherwise leave a
          member who has just taken a seat with nowhere to click. */}
      <Link
        href={withLang(`/courses/${seat.topicSlug}`, seat.lang)}
        className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
      >
        {t("openCourse")}
      </Link>
    </section>
  );
}

// The refusal tags the credentials provider throws, turned into something a stranger
// can act on. Each one sends them somewhere different, which is the whole reason the
// server distinguishes them: a typo is theirs to fix, a stopped or full code means
// asking their organisation. (The PIN tags went with the PIN on 2026-08-27, and
// `nickname-taken` is now only a same-instant race whose loser's retry signs in, so
// both fall through to the generic line.)
//
// **Never a raw tag and never "Server Error".** Only a `ConvexError`'s `data`
// survives a production deployment, which is why the server throws tags rather than
// sentences, and why anything untagged falls through to a generic line here.
function messageFor(e: unknown, t: (key: string) => string): string {
  const tag = e instanceof ConvexError && typeof e.data === "string" ? e.data : "";
  switch (tag) {
    case "access/code-unknown":
      return t("errUnknown");
    case "access/code-stopped":
      return t("errStopped");
    case "access/code-full":
      return t("errFull");
    case "access/consent-required":
      return t("errConsent");
    default:
      return t("errGeneric");
  }
}
