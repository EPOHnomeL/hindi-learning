"use client";

import { Authenticated, AuthLoading, Unauthenticated, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { normaliseCode } from "../../../convex/voucherCode";
import { SignIn } from "./SignIn";
import { withLang } from "./editionUrl";

// The `/redeem` journey (vouchers ticket 06, ADR 0029). The only path in this
// feature walked by somebody who has never seen the platform, has no account, and
// was handed a code by their organisation with little explanation. Everything
// upstream is worthless if this loses them.
//
// **The signed-out round trip is the risky part.** Redemption is auth-first: it
// mints onto the signed-in caller and takes no email (ADR 0021), so the member has
// to sign up mid-flow. Losing the code at that boundary is the failure mode this
// component is shaped around, so the code is carried TWO ways, because the two
// fail in different places: the URL (`?code=`) survives a re-render and a shared
// link, and localStorage survives the Google OAuth round trip, which leaves the
// origin entirely and can come back to a bare path.
const CODE_KEY = "hindi:redeem-code";

// Best-effort both ways: storage can be disabled, and the URL is the primary
// carrier, so a failure here costs a fallback rather than the flow.
function stash(code: string) {
  try {
    window.localStorage.setItem(CODE_KEY, code);
  } catch {
    /* storage unavailable - the URL still carries it */
  }
}
function unstash(): string {
  try {
    return window.localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function RedeemPanel() {
  const t = useTranslations("Redeem");
  // Read once on mount rather than during render: `window` does not exist on the
  // server, so reading inline would be a hydration mismatch. Same mount-gating the
  // SignIn screen's "last used" pill uses.
  const [code, setCode] = useState("");
  // Whether the code arrived WITH them rather than being typed. A member who
  // followed `?code=` from the CSV has already handed the code over by clicking
  // the link, so asking them to confirm it in a form is a step that exists only
  // because the page could not tell the two cases apart. Null while the effect
  // below has not run, so nothing decides on a half-read URL.
  const [linked, setLinked] = useState<boolean | null>(null);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("code") ?? "";
    setCode(normaliseCode(fromUrl || unstash()));
    setLinked(!!normaliseCode(fromUrl));
  }, []);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-accent">{t("title")}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-soft">{t("blurb")}</p>

      <AuthLoading>
        <div className="mt-6 h-32 animate-pulse rounded-2xl border border-line bg-card" />
      </AuthLoading>

      <Unauthenticated>
        {linked === null ? (
          <div className="mt-6 h-32 animate-pulse rounded-2xl border border-line bg-card" />
        ) : (
          <SignedOutRedeem code={code} setCode={setCode} linked={linked} />
        )}
      </Unauthenticated>

      <Authenticated>
        <SignedInRedeem code={code} setCode={setCode} />
      </Authenticated>
    </div>
  );
}

// Signed out: take the code FIRST, then ask for an account. The other order is
// what loses people - a stranger who is shown a sign-up wall before anything has
// acknowledged their code has no reason to believe this is the right site.
function SignedOutRedeem({ code, setCode, linked }: { code: string; setCode: (c: string) => void; linked: boolean }) {
  const t = useTranslations("Redeem");
  // A code that came in on the link is already handed over: they clicked it. Only
  // somebody typing off a card starts on the form.
  const [handedOver, setHandedOver] = useState(linked);
  // Stash it on arrival too, not only on submit - the member who followed a link
  // never presses the button that used to do this, and the OAuth round trip can
  // come back to a bare path.
  useEffect(() => {
    if (linked && code) stash(code);
  }, [linked, code]);

  if (handedOver) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        {/* Say the code is safe, on the screen where they are most likely to fear
            losing it. It is in the URL and in localStorage by this point. */}
        <p className="rounded-xl border border-gold/40 bg-card px-4 py-3 text-sm leading-relaxed text-ink">
          {t("codeKept", { code })}
        </p>
        <SignIn embedded />
      </div>
    );
  }

  return (
    <CodeForm
      code={code}
      setCode={setCode}
      submitLabel={t("continue")}
      onSubmit={(entered) => {
        stash(entered);
        // Put it in the URL too, so a reload, a back button or a re-render during
        // the auth hop all come back to the same code.
        const url = new URL(window.location.href);
        url.searchParams.set("code", entered);
        window.history.replaceState(null, "", url.toString());
        setHandedOver(true);
      }}
    />
  );
}

// Signed in: redeem. If a code came with them from the signed-out half, this
// fires once on mount, so somebody who typed a code and then created an account
// lands on their access rather than on the same form a second time.
function SignedInRedeem({ code, setCode }: { code: string; setCode: (c: string) => void }) {
  const t = useTranslations("Redeem");
  const redeem = useMutation(api.vouchers.redeem);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ topicSlug: string; lang: string; courseTitle: string } | null>(null);
  // One automatic attempt per visit, whatever React does with effects: a second
  // fire would report the member's own fresh seat back to them as "already used".
  const auto = useRef(false);

  const run = async (entered: string) => {
    setBusy(true);
    setError(null);
    try {
      const where = await redeem({ code: entered });
      try {
        window.localStorage.removeItem(CODE_KEY);
      } catch {
        /* nothing to clean up */
      }
      setDone(where);
    } catch (e) {
      setError(messageFor(e, t));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (auto.current || !code) return;
    auto.current = true;
    void run(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // The language is always explicit in the URL: left implicit, the reader can
  // resolve to a different free Edition of the same course.
  useEffect(() => {
    if (done) router.replace(withLang(`/courses/${done.topicSlug}`, done.lang));
  }, [done, router]);

  if (done) {
    // Straight into the course, not a button offering to go there. The seat is
    // granted and permanent by this point, so the panel was a dead end asking for
    // one more click before anything happened - and the course's own welcome
    // dialog is the right first thing to meet. `replace`, not `push`: going Back
    // from the reader must not land on a redeem form whose code is now spent.
    return (
      <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-gold/40 bg-card px-5 py-4">
        <b className="text-base font-semibold text-accent">{t("successTitle")}</b>
        <p className="text-sm leading-relaxed text-soft">{t("successBody", { course: done.courseTitle })}</p>
        {/* A fallback, not the way through: the effect below is already navigating.
            It stays because a blocked or slow client-side push would otherwise
            leave a member who has just spent their code with nowhere to click. */}
        <Link
          href={withLang(`/courses/${done.topicSlug}`, done.lang)}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          {t("openCourse")}
        </Link>
      </div>
    );
  }

  return (
    <CodeForm
      code={code}
      setCode={setCode}
      submitLabel={busy ? t("working") : t("submit")}
      disabled={busy}
      error={error}
      onSubmit={(entered) => void run(entered)}
    />
  );
}

// The one input. Normalised as they type, so the thing on screen is the thing
// being looked up: they are copying it off a printed card or a phone screen, and
// a code that "does not exist" because of a stray space or a lower-case letter is
// indistinguishable to them from a dud one.
function CodeForm({
  code,
  setCode,
  submitLabel,
  onSubmit,
  disabled,
  error,
}: {
  code: string;
  setCode: (c: string) => void;
  submitLabel: string;
  onSubmit: (code: string) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const t = useTranslations("Redeem");
  return (
    <form
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const entered = normaliseCode(code);
        if (!entered) return;
        setCode(entered);
        onSubmit(entered);
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
          onChange={(e) => setCode(normaliseCode(e.target.value))}
          className="w-full rounded-lg border border-line bg-hi px-3 py-2.5 font-mono text-lg tracking-widest text-ink focus:border-gold focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || !code}
        className="rounded-lg bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {submitLabel}
      </button>
      {/* The page never asks for an email in order to redeem: the only address it
          ever collects is the one sign-up collects, chosen by the member. That is
          how the organisation's list stays undisclosed. */}
      {error && <p className="text-sm leading-relaxed text-danger">{error}</p>}
    </form>
  );
}

// The refusal tags `vouchers.redeem` throws, turned into something a stranger can
// act on. Each one sends them somewhere different, which is the whole reason the
// server distinguishes them: a typo is theirs to fix, a spent code means asking
// the organisation for another, and already having access means the code was NOT
// consumed and can be passed to somebody who needs it.
function messageFor(e: unknown, t: (key: string) => string): string {
  const tag = e instanceof ConvexError && typeof e.data === "string" ? e.data : "";
  switch (tag) {
    case "voucher/code-unknown":
      return t("errUnknown");
    case "voucher/code-used":
      return t("errUsed");
    case "voucher/batch-voided":
      return t("errVoided");
    case "voucher/already-have-access":
      return t("errAlreadyHaveAccess");
    default:
      return t("errGeneric");
  }
}
