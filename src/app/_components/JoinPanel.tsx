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
// **Two sentences on this page are compliance controls, not copy**, and an editor
// tidying them is editing a control:
//
//   - The nickname hint says the nickname need not be a real name. Under POPIA a real
//     name beside a political party's cohort is special personal information (s26 via
//     s1); a self-chosen handle is materially weaker on that limb. A UI that nudges
//     members toward their real name removes the mitigation the whole design rests on.
//   - The PIN hint says a forgotten PIN cannot be recovered by anybody. That is true,
//     there is no reset flow and there must never be one, and a member who was not
//     told will reasonably believe support can help.
//
// **Consent comes before the nickname box**, because consent obtained after the fact
// is not consent, and because s11(2) puts the burden of proving it on us.

// The three steps, in order. Consent first, always.
type Step = "consent" | "code" | "identity";

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
  const [step, setStep] = useState<Step>("consent");
  const [refused, setRefused] = useState(false);
  // Already normalised by the server component that read it. Nothing in this
  // component touches the URL: see `join/page.tsx` for why the read moved there.
  const [typedCode, setTypedCode] = useState("");
  const code = linkedCode || typedCode;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-accent">{t("title")}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-soft">{t("blurb")}</p>

      {refused ? (
        <Refused onBack={() => setRefused(false)} />
      ) : step === "consent" ? (
        // **A code that arrived on the link skips the code step entirely.** Somebody
        // who followed `/join?code=...` has already handed the code over by clicking,
        // so a box asking them to confirm it is a step that exists only because the
        // page could not tell the two cases apart. `/redeem` learned the same lesson.
        <Consent onAgree={() => setStep(linkedCode ? "identity" : "code")} onRefuse={() => setRefused(true)} />
      ) : step === "code" ? (
        <CodeStep code={typedCode} setCode={setTypedCode} onNext={() => setStep("identity")} />
      ) : (
        <Identity code={code} linked={!!linkedCode} onBack={() => setStep("code")} />
      )}
    </>
  );
}

// Step 1. The wording lives in `convex/joinConsent.ts` (versioned, append only) and
// is TRANSLATED here, because consent has to be *informed* and a member reading
// Afrikaans cannot be informed by English. The version travels with the join and is
// stored on the Seat, so what a particular member agreed to is answerable a year
// later.
//
// **The buttons are not pre-ticked and there is no default.** POPIA defines consent
// as "any voluntary, specific and informed expression of will", and a box that is
// already ticked expresses nothing.
function Consent({ onAgree, onRefuse }: { onAgree: () => void; onRefuse: () => void }) {
  const t = useTranslations("Join");
  const lines = t.raw("consentLines") as string[];
  return (
    <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-ink">{t("consentTitle")}</h2>
      <ul className="flex flex-col gap-2.5">
        {lines.map((line, i) => (
          <li key={i} className="text-sm leading-relaxed text-soft">
            {line}
          </li>
        ))}
      </ul>
      {/* The detail lives in the Terms and the Privacy Policy, linked rather than
          restated. Three short lines are what somebody standing in a room actually
          reads, and consent nobody read is not "informed" however carefully it was
          drafted; the link is what keeps it "specific" for anybody who wants the
          whole undertaking. Opens in a new tab so a member reading it does not lose
          the code they arrived with. */}
      <p className="text-[11.5px] leading-relaxed text-soft">
        {t.rich("consentMore", {
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAgree}
          className="rounded-lg bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          {t("consentAgree")}
        </button>
        {/* Refusing is a real choice with a real destination, not a dead end that
            leaves them looking at the same screen. */}
        <button
          type="button"
          onClick={onRefuse}
          className="rounded-lg border border-line px-3.5 py-2.5 text-sm font-medium text-soft transition-colors hover:border-danger hover:text-danger"
        >
          {t("consentRefuse")}
        </button>
      </div>
    </section>
  );
}

// What a member who refuses can do instead. Refusing has to be a real choice, and a
// choice with nothing on the other side of it is a wall.
function Refused({ onBack }: { onBack: () => void }) {
  const t = useTranslations("Join");
  return (
    <section className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-semibold text-ink">{t("refusedTitle")}</h2>
      <p className="text-sm leading-relaxed text-soft">{t("refusedBody")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/"
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          {t("refusedBrowse")}
        </Link>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-soft transition-colors hover:border-accent hover:text-accent"
        >
          {t("refusedBack")}
        </button>
      </div>
    </section>
  );
}

// Step 2. Normalised as they type, so the thing on screen is the thing being looked
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

// Step 3. Nickname, PIN, and **which of the two things they are doing**.
//
// The new/returning choice is not a convenience. A code plus an existing nickname
// plus a wrong PIN is the same request either way, so without a declared intent the
// server cannot tell "that nickname is taken, pick another" from "you typed your PIN
// wrong" - and those send the member to two different actions. Asking is what makes
// both answers possible.
function Identity({ code, linked, onBack }: { code: string; linked: boolean; onBack: () => void }) {
  const t = useTranslations("Join");
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"join" | "return">("join");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Four characters, matching the server, and stated rather than enforced silently:
  // a disabled button with no explanation is a dead end on a phone.
  const ready = nickname.trim().length > 0 && pin.length >= 4;

  return (
    <form
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        setBusy(true);
        setError(null);
        try {
          await signIn("accessCode", { flow, code, nickname, pin, consentVersion: CONSENT_VERSION });
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

      {/* Which door they are coming through. Two buttons rather than a select: this
          is read on a phone by somebody who has never seen the site. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("whichLabel")}</span>
        <div className="flex gap-2">
          {(["join", "return"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={flow === f}
              onClick={() => {
                setFlow(f);
                setError(null);
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                flow === f ? "border-accent bg-accent/10 text-accent" : "border-line text-soft hover:border-accent"
              }`}
            >
              {f === "join" ? t("iAmNew") : t("iAmReturning")}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("nicknameLabel")}</span>
        <input
          value={nickname}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={t("nicknamePlaceholder")}
          onChange={(e) => {
            setNickname(e.target.value);
            setError(null);
          }}
          className="w-full rounded-lg border border-line bg-hi px-3 py-2.5 text-base text-ink focus:border-gold focus:outline-none"
        />
        {/* COMPLIANCE CONTROL. See the header comment. Do not soften this into
            "your name" and do not add a real-name placeholder. */}
        <span className="text-[11.5px] leading-relaxed text-soft">{t("nicknameHint")}</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-accent2">{t("pinLabel")}</span>
        <input
          value={pin}
          type="password"
          inputMode="numeric"
          autoComplete={flow === "join" ? "new-password" : "current-password"}
          placeholder={t("pinPlaceholder")}
          onChange={(e) => {
            setPin(e.target.value);
            setError(null);
          }}
          className="w-full rounded-lg border border-line bg-hi px-3 py-2.5 font-mono text-base tracking-widest text-ink focus:border-gold focus:outline-none"
        />
        {/* COMPLIANCE CONTROL, and the true statement the whole rail depends on:
            there is no reset flow, because a reset needs a second channel and the
            second channel is the email this design exists to avoid. */}
        <span className="text-[11.5px] leading-relaxed text-soft">
          {flow === "join" ? t("pinHintNew") : t("pinHintReturn")}
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy || !ready}
          className="rounded-lg bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? t("working") : flow === "join" ? t("submitJoin") : t("submitReturn")}
        </button>
        {/* Only when they TYPED it. A linked code lives in the URL, so "change it"
            would have to fight the query string it came from; a member who followed
            the wrong link edits the link, not a form. */}
        {!linked && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-soft transition-colors hover:border-accent hover:text-accent"
          >
            {t("changeCode")}
          </button>
        )}
      </div>
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
// server distinguishes them: a typo is theirs to fix, a taken nickname means picking
// another, a stopped or full code means asking their organisation, and a wrong PIN
// means checking what they typed.
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
    case "access/nickname-taken":
      return t("errNicknameTaken");
    case "access/pin-wrong":
      return t("errPinWrong");
    case "access/consent-required":
      return t("errConsent");
    case "access/too-many-attempts":
      return t("errTooMany");
    default:
      return t("errGeneric");
  }
}
