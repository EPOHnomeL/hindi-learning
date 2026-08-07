"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Icon } from "./icons";
import { useTenantSlug } from "./TenantContext";

// The landing pages' **second conversion** (ADR 0028): one field, one button, an
// email address — for the visitor who won't sign in yet. Sign-in stays the primary
// action on both pages; this is the fallback that stops a not-ready visitor being
// a total loss.
//
// The shape is lifted from spoorpet.com, which does three things worth copying and
// which this component is:
//   1. **One field.** Email only. No name, no phone, no "how did you hear".
//      Every extra field is a reason to close the tab.
//   2. **The source is tagged**, so the operator can tell which ask converted.
//      A closed union server-side (convex/interest.ts), so the number stays real.
//   3. **Success REPLACES the form.** Not a toast over an empty input the visitor
//      then wonders whether to fill in again.
//
// There is exactly ONE of these per page, and it sits BELOW the sign-in section.
// That placement is the one deliberate departure from the brief, which puts its
// form above the fold: spoorpet.com has nothing to sell, so the address IS the
// conversion, whereas here sign-in is — and a visitor who scrolled past sign-in
// has told us they're not ready, which is precisely who this asks. Two forms on a
// page would mean two places a half-typed address can be stranded, so there is
// only ever one.

// Every CTA that may write a lead. Mirrors `LEAD_SOURCES` in convex/interest.ts,
// which is the gate; this type just stops a typo compiling.
export type LeadSource = "landing-footer" | "landing-hero" | "ywampotch-footer" | "ywampotch-hero";

// The form's element id, so the ask can be linked to directly (a mail-out, a
// social post). Nothing in-page scrolls to it — see the placement note above.
export const INTEREST_ANCHOR = "keep-me-posted";

// The same shape check the server runs (convex/interest.ts `isDeliverableShape`).
// Duplicated deliberately and kept loose: this copy exists so the visitor gets a
// useful message without a round-trip, the server's copy is the actual gate, and
// anything stricter than "plainly undeliverable" rejects real addresses.
function looksDeliverable(email: string): boolean {
  const at = email.indexOf("@");
  if (at <= 0 || email.indexOf("@", at + 1) !== -1) return false;
  const domain = email.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".") && !/\s/.test(email);
}

export type InterestFormCopy = {
  /** The ask, above the field. */
  heading: string;
  /** Why it's worth their address. One line. */
  body: string;
  /** Field placeholder — an example address, not "Enter your email". */
  placeholder: string;
  /** Button at rest. */
  submit: string;
  /** Button mid-flight. */
  submitting: string;
  /** Shown when the address plainly can't be delivered to. */
  invalid: string;
  /** Shown when the write itself failed — the one error they can retry out of. */
  failed: string;
  /** Success card title. */
  doneTitle: string;
  /** Success card body. */
  doneBody: string;
  /** Accessible label for the field, since the visible label is the heading. */
  fieldLabel: string;
};

export function InterestForm({ source, copy }: { source: LeadSource; copy: InterestFormCopy }) {
  const slug = useTenantSlug();
  const register = useMutation(api.interest.register);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    const trimmed = email.trim();
    if (!looksDeliverable(trimmed)) {
      setError(copy.invalid);
      return;
    }
    setError("");
    setState("sending");
    try {
      // `slug` is null on the default site, where there is no tenant row — the
      // list still needs a bucket, so the platform's own leads live under
      // "default". Matches how the registry treats the default host.
      await register({ email: trimmed, tenantSlug: slug ?? "default", source });
      setState("done");
    } catch {
      // Deliberately generic: the server's messages are for us, and the only
      // actionable thing a visitor can do is try again.
      setState("idle");
      setError(copy.failed);
    }
  }

  return (
    <div id={INTEREST_ANCHOR} className="scroll-mt-24">
      {state === "done" ? (
        // Replaces the form outright. An empty input beside a "thanks!" is an
        // invitation to submit twice.
        <div
          className="land-reveal flex items-start gap-3 rounded-lg border border-gold/40 bg-gold/10 p-5"
          role="status"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold/25 text-accent">
            <Icon name="check" className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-semibold text-ink">{copy.doneTitle}</span>
            <span className="mt-1 block text-sm leading-relaxed text-soft">{copy.doneBody}</span>
          </span>
        </div>
      ) : (
        <div className="land-reveal">
          <h3 className="text-lg font-semibold tracking-tight text-ink">{copy.heading}</h3>
          <p className="mt-2 text-sm leading-relaxed text-soft">{copy.body}</p>
          {/* `noValidate` so our message shows instead of the browser's tooltip,
              which is unstyled, untranslated and disappears on the next keypress. */}
          <form onSubmit={(e) => void submit(e)} noValidate className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              maxLength={254}
              placeholder={copy.placeholder}
              aria-label={copy.fieldLabel}
              aria-invalid={error !== ""}
              className="min-w-0 flex-1 rounded-lg border border-line bg-card px-4 py-2.5 text-sm text-ink placeholder:text-soft/70 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              {state === "sending" ? copy.submitting : copy.submit}
            </button>
          </form>
          {error !== "" && (
            <p className="mt-2 text-sm text-bad-b" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
