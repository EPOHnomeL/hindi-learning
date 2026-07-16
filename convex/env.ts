import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Central registry for the PayFast rail's Convex env vars — the one place that
// declares which vars exist and their allowed values (the operator's cheat
// sheet). Other Convex env vars (PUBLISH_SECRET, OPENROUTER_*, RESEND_*, …) are
// still read directly where they're used; move them here as the need arises.
//
// Read via env() at CALL time, deliberately NOT a module-level `const env`:
// Convex reads process.env per invocation (flip a var on the deployment and it
// takes effect without a code redeploy), and the test suite toggles these per
// test. A cached const would freeze the first value seen and break both. Each
// call re-validates the live process.env, so a bad value (e.g. PAYFAST_MODE=
// "prod") throws loudly here instead of silently defaulting downstream.
export function env() {
  return createEnv({
    server: {
      // The rail's operating mode. "off" pauses selling platform-wide (the kill
      // switch) with the credentials left intact; "live"/"sandbox" select the
      // gateway. Case/space tolerant; unset or blank ⇒ sandbox (never live).
      PAYFAST_MODE: z.preprocess(
        (v) => {
          if (typeof v !== "string") return v;
          const t = v.trim().toLowerCase();
          return t === "" ? undefined : t;
        },
        z.enum(["live", "sandbox", "off"]).default("sandbox"),
      ),
      // The merchant credentials + passphrase every signed checkout needs.
      // Optional: any one absent ⇒ selling is off platform-wide (see
      // payfastConfigured); provisioning all three re-enables it.
      PAYFAST_MERCHANT_ID: z.string().min(1).optional(),
      PAYFAST_MERCHANT_KEY: z.string().min(1).optional(),
      PAYFAST_PASSPHRASE: z.string().min(1).optional(),
      // The platform's cut of net, in basis points (0–10000). Any missing or
      // out-of-range value falls back to 5000 (50%) — the split must never break.
      PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).catch(5000),
      // The app origin PayFast's hosted flow returns to (same-origin enforced in
      // appUrl). Optional here; appUrl throws if it's needed and unset.
      SITE_URL: z.string().url().optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    // Convex functions are always server-side — don't rely on `window` detection
    // (the runtime under test is edge-runtime, and the real one is Convex's V8).
    isServer: true,
    // Name the offending var in the thrown message (the default is an opaque
    // "Invalid environment variables"), so a bad PAYFAST_MODE etc. is obvious.
    onValidationError: (error) => {
      const detail = error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      throw new Error(`Invalid PayFast env config — ${detail}`);
    },
  });
}
