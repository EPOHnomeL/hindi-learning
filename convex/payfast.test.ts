import { afterEach, beforeEach, expect, test } from "vitest";
import {
  appUrl,
  buildCheckoutFields,
  centsFromRand,
  md5,
  pfParamString,
  platformFeeBps,
  processUrl,
  randFromCents,
  sellingDisabled,
  sellingEnabled,
  signFields,
  splitNet,
  validateUrl,
  verifySignature,
} from "./payfast";

// PayFast payments — the pure module (ticket 01, .scratch/payfast-payments).
// Everything here is deterministic and network-free: the inline MD5, PayFast's
// signature scheme, the checkout field builder, the 50/50 net-split math, ZAR
// formatting, and the mode-switched gateway URLs. The vectors were computed
// independently (node:crypto), so a wrong MD5/canonicalisation can't self-verify.

const ENV = [
  "PLATFORM_FEE_BPS",
  "PAYFAST_MODE",
  "SITE_URL",
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_MERCHANT_KEY",
  "PAYFAST_PASSPHRASE",
] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ---- MD5 (RFC 1321 test vectors — Convex's runtime has no native MD5) --------

test("md5 matches the RFC 1321 vectors", () => {
  expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
  // 80 bytes — crosses the 64-byte block boundary, exercising padding.
  expect(md5("12345678901234567890123456789012345678901234567890123456789012345678901234567890")).toBe(
    "57edf4a22be3c955ac49da2e2107b67a",
  );
});

test("md5 hashes UTF-8 bytes, not UTF-16 code units", () => {
  // "—" (U+2014) is 3 UTF-8 bytes; a code-unit hash would differ. Vector from node:crypto.
  expect(md5("Hindi — Spanish edition")).toBe(md5Independent());
});
// Computed once with node:crypto (md5 of the UTF-8 bytes).
function md5Independent(): string {
  return "d1d22127c0c2345260478ca35dc527cb";
}

// ---- signature scheme (fields in given order + passphrase — PayFast's scheme) --

const FIELDS = {
  merchant_id: "10000100",
  merchant_key: "46f0cd694581a",
  amount: "123.45",
  item_name: "Hindi — Spanish edition",
  email_address: "buyer@example.com",
  m_payment_id: "", // empty values stay in the canonical string (PayFast's ITN sample keeps them)
};
const PASSPHRASE = "jt7NOE43FZPn";

test("pfParamString canonicalises in FIELD ORDER (never sorted), PHP-urlencoded, minus signature", () => {
  expect(pfParamString({ ...FIELDS, signature: "deadbeef" })).toBe(
    "merchant_id=10000100&merchant_key=46f0cd694581a&amount=123.45" +
      "&item_name=Hindi+%E2%80%94+Spanish+edition&email_address=buyer%40example.com&m_payment_id=",
  );
});

test("signFields signs the in-order fields + passphrase (known vector)", () => {
  // Independently computed (node:crypto) over the canonical string above +
  // &passphrase=jt7NOE43FZPn. PayFast signs over the field ORDER (form: its
  // documented attribute order; ITN: the order received) — never alphabetical.
  expect(signFields(FIELDS, PASSPHRASE)).toBe("40c5b77b19841e02c9421e33de29f309");
});

test("verifySignature round-trips a built signature and rejects a forged one", () => {
  const signature = signFields(FIELDS, PASSPHRASE);
  expect(verifySignature({ ...FIELDS, signature }, PASSPHRASE)).toBe(true);
  expect(verifySignature({ ...FIELDS, signature: "0".repeat(32) }, PASSPHRASE)).toBe(false);
  // A tampered amount no longer matches the signature.
  expect(verifySignature({ ...FIELDS, amount: "1.00", signature }, PASSPHRASE)).toBe(false);
  // Re-ordered fields don't verify either — the order is part of the signature.
  const { merchant_id, ...rest } = FIELDS;
  expect(verifySignature({ ...rest, merchant_id, signature }, PASSPHRASE)).toBe(false);
  // No signature at all → rejected.
  expect(verifySignature(FIELDS, PASSPHRASE)).toBe(false);
});

// ---- the checkout field builder ----------------------------------------------

test("buildCheckoutFields returns the signed PayFast field set", () => {
  const fields = buildCheckoutFields({
    merchantId: "10000100",
    merchantKey: "46f0cd694581a",
    returnUrl: "https://app.example.com/courses/hindi?purchase=return",
    cancelUrl: "https://app.example.com/courses/hindi",
    notifyUrl: "https://site.convex.site/payfast/notify",
    mPaymentId: "mp_123",
    amountCents: 150000,
    itemName: "Hindi — Spanish edition",
    email: "buyer@example.com",
    topicId: "topic123",
    lang: "es",
    passphrase: PASSPHRASE,
  });
  expect(fields).toMatchObject({
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    return_url: "https://app.example.com/courses/hindi?purchase=return",
    cancel_url: "https://app.example.com/courses/hindi",
    notify_url: "https://site.convex.site/payfast/notify",
    m_payment_id: "mp_123",
    amount: "1500.00", // cents → 2-decimal Rand
    item_name: "Hindi — Spanish edition",
    email_address: "buyer@example.com",
    custom_str1: "topic123",
    custom_str2: "es",
  });
  // The signature is PayFast's own scheme over these fields — verifiable in reverse.
  expect(verifySignature(fields, PASSPHRASE)).toBe(true);
});

// ---- the net split (50/50 on amount_net) --------------------------------------

test("splitNet halves a normal sale's net and always sums back to it", () => {
  expect(splitNet(8846, 5000)).toEqual({ sellerShare: 4423, platformShare: 4423 });
  // Odd cent: rounding never loses or mints money.
  const odd = splitNet(8847, 5000);
  expect(odd.sellerShare + odd.platformShare).toBe(8847);
  expect(odd.sellerShare).toBeGreaterThanOrEqual(0);
  expect(odd.platformShare).toBeGreaterThanOrEqual(0);
});

test("the bps is the PLATFORM's share — its name, and the platform's take-rate convention", () => {
  // PLATFORM_FEE_BPS names the platform's cut (the old rail's 1500 meant a 15%
  // platform take). At 5000 the direction is invisible; at any other value it
  // must follow the name — the PRD's literal formula had it backwards.
  expect(splitNet(10000, 2500)).toEqual({ sellerShare: 7500, platformShare: 2500 });
  expect(splitNet(10000, 0)).toEqual({ sellerShare: 10000, platformShare: 0 });
  expect(splitNet(10000, 10000)).toEqual({ sellerShare: 0, platformShare: 10000 });
});

test("splitNet on a fixed-fee-heavy cheap sale still yields non-negative shares summing to net", () => {
  // A R5 course: PayFast's ~R2+2% fee leaves ~257c net. Nothing goes negative.
  const tiny = splitNet(257, 5000);
  expect(tiny.sellerShare + tiny.platformShare).toBe(257);
  expect(tiny.sellerShare).toBeGreaterThanOrEqual(0);
  expect(tiny.platformShare).toBeGreaterThanOrEqual(0);
  // Degenerate: a 1-cent net still splits without going negative.
  const one = splitNet(1, 5000);
  expect(one.sellerShare + one.platformShare).toBe(1);
  expect(one.sellerShare).toBeGreaterThanOrEqual(0);
});

test("platformFeeBps defaults to 5000 and rejects out-of-bounds values", () => {
  delete process.env.PLATFORM_FEE_BPS;
  expect(platformFeeBps()).toBe(5000);
  process.env.PLATFORM_FEE_BPS = "2500";
  expect(platformFeeBps()).toBe(2500);
  process.env.PLATFORM_FEE_BPS = "20000"; // >100% → fall back
  expect(platformFeeBps()).toBe(5000);
  process.env.PLATFORM_FEE_BPS = "-1";
  expect(platformFeeBps()).toBe(5000);
  process.env.PLATFORM_FEE_BPS = "banana";
  expect(platformFeeBps()).toBe(5000);
});

// ---- ZAR formatting ------------------------------------------------------------

test("randFromCents renders cents as 2-decimal Rand", () => {
  expect(randFromCents(150000)).toBe("1500.00");
  expect(randFromCents(999)).toBe("9.99");
  expect(randFromCents(5)).toBe("0.05");
});

test("centsFromRand parses PayFast amount strings to integer cents (fees arrive negative)", () => {
  expect(centsFromRand("1500.00")).toBe(150000);
  expect(centsFromRand("9.9")).toBe(990);
  expect(centsFromRand("1200")).toBe(120000);
  expect(centsFromRand("-4.60")).toBe(-460); // ITN amount_fee
  expect(centsFromRand(" 12.34 ")).toBe(1234);
  expect(centsFromRand("")).toBeNull();
  expect(centsFromRand("12,34")).toBeNull();
  expect(centsFromRand("1.2.3")).toBeNull();
  expect(centsFromRand("abc")).toBeNull();
});

// ---- gateway URLs by PAYFAST_MODE ----------------------------------------------

test("processUrl / validateUrl switch on PAYFAST_MODE and default to sandbox", () => {
  process.env.PAYFAST_MODE = "live";
  expect(processUrl()).toBe("https://www.payfast.co.za/eng/process");
  expect(validateUrl()).toBe("https://www.payfast.co.za/eng/query/validate");
  process.env.PAYFAST_MODE = "sandbox";
  expect(processUrl()).toBe("https://sandbox.payfast.co.za/eng/process");
  expect(validateUrl()).toBe("https://sandbox.payfast.co.za/eng/query/validate");
  // Unset → sandbox: a missing env var must never hit the live gateway.
  delete process.env.PAYFAST_MODE;
  expect(processUrl()).toBe("https://sandbox.payfast.co.za/eng/process");
});

// ---- selling kill switch (PAYFAST_MODE=off) ------------------------------------

test("sellingEnabled: a provisioned rail is live unless PAYFAST_MODE=off pauses it", () => {
  process.env.PAYFAST_MERCHANT_ID = "10000100";
  process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
  process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";

  // Every valid mode except "off" sells — unset, sandbox, live (case tolerant).
  for (const m of [undefined, "sandbox", "live", "SANDBOX", "Live"]) {
    if (m === undefined) delete process.env.PAYFAST_MODE;
    else process.env.PAYFAST_MODE = m;
    expect(sellingDisabled()).toBe(false);
    expect(sellingEnabled()).toBe(true);
  }

  // PAYFAST_MODE=off pauses selling (case/space tolerant), rail fully provisioned.
  for (const m of ["off", "OFF", " Off "]) {
    process.env.PAYFAST_MODE = m;
    expect(sellingDisabled()).toBe(true);
    expect(sellingEnabled()).toBe(false);
  }

  // An unrecognised mode is a misconfiguration — fail loud, never silently guess.
  for (const m of ["disable", "prod", "true"]) {
    process.env.PAYFAST_MODE = m;
    expect(() => sellingEnabled()).toThrow(/PAYFAST_MODE/);
  }

  // Missing credentials → off regardless of mode.
  delete process.env.PAYFAST_MODE;
  delete process.env.PAYFAST_PASSPHRASE;
  expect(sellingEnabled()).toBe(false);
});

// ---- appUrl (moved over from stripe.ts, behaviour unchanged) --------------------

test("appUrl enforces same-origin — no open redirect off SITE_URL", () => {
  process.env.SITE_URL = "https://app.example.com";
  expect(appUrl("/courses/hindi?lang=es")).toBe("https://app.example.com/courses/hindi?lang=es");
  expect(appUrl("//evil.com")).toBe("https://app.example.com/");
  expect(appUrl("https://evil.com/phish")).toBe("https://app.example.com/");
});
