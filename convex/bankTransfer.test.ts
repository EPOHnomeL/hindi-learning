/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { formatReference, newReference, normaliseReference } from "./bankTransfer";

// Bank transfer payments (.scratch/bank-transfer-payments) — the manual money
// path. The seams tested here:
//   1. The reference (pure): a transcribable shape over an unambiguous alphabet.
//   2. Collection accounts: owner-scoped CRUD, validation, disable-not-delete.
//   3. Requesting: auth-first, paid-Edition-only, one open reference per Edition,
//      and the buyer's read is the ONLY one that returns bank details.
//   4. Approval: the grant. `preview` → `entitled`, one Ledger row with the split,
//      idempotent, owner-or-Admin only. Decline grants nothing.
//   5. Rail independence: none of it reads a PAYFAST_* var — this file NEVER sets
//      them, so every test below proves bank transfer works with PayFast absent.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const id = await t.run((ctx) => ctx.db.insert("users", { email }));
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true }));
  return id;
}
async function addLesson(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, key: string, seq: number) {
  await t.run(async (ctx) => {
    const htmlStorageId = await ctx.storage.store(new Blob([`<p>en ${key}</p>`], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key, seq, title: `Lesson ${key}`, htmlStorageId });
  });
}

const INDIA = {
  label: "India (INR)",
  country: "IN",
  currency: "INR",
  accountHolder: "Y-Knot Learning",
  bankName: "HDFC Bank",
  accountNumber: "50100 1234 5678",
  routingCode: "HDFC0001234",
  swift: "hdfcinbb",
  instructions: "Quote the reference in the remarks field.",
};
const SA = {
  label: "South Africa (ZAR)",
  country: "ZA",
  currency: "ZAR",
  accountHolder: "Y-Knot Learning",
  bankName: "FNB",
  accountNumber: "62000000001",
  routingCode: "250655",
};

// A completed, priced English Edition with two Lessons (0001 is the Preview), an
// owner who offers one Indian Collection account, and a signed-up buyer.
async function fixture(t: ReturnType<typeof convexTest>) {
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: alice, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang: "en", amount: 50_000, currency: "zar" }));
  const accountId = await asUser(t, alice).mutation(api.bankTransfer.addBankAccount, INDIA);
  return { alice, bob, topicId, accountId };
}

// ---- 1. the reference (pure) -------------------------------------------------

test("a minted reference is transcribable: MC-XXXX-XXXX over an unambiguous alphabet", () => {
  for (let i = 0; i < 200; i++) {
    const ref = newReference();
    expect(ref).toMatch(/^MC-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    // The look-alikes are what make a hand-typed reference unmatchable.
    expect(ref.slice(3)).not.toMatch(/[IO01]/);
  }
  // Distinct enough that a collision is the DB check's rare fallback, not the norm.
  expect(new Set(Array.from({ length: 200 }, newReference)).size).toBeGreaterThan(195);
});

test("a reference typed by a human normalises back to its canonical form", () => {
  expect(normaliseReference("mc7k2p9qx4")).toBe("MC-7K2P-9QX4");
  expect(normaliseReference("  MC-7K2P-9QX4 ")).toBe("MC-7K2P-9QX4");
  expect(normaliseReference("mc 7k2p 9qx4")).toBe("MC-7K2P-9QX4");
  expect(formatReference("7K2P9QX4")).toBe("MC-7K2P-9QX4");
});

// ---- 2. Collection accounts --------------------------------------------------

test("Collection accounts are owner-scoped, and their details normalise on save", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const bob = await seedUser(t, "bob@example.com");

  const id = await asUser(t, alice).mutation(api.bankTransfer.addBankAccount, INDIA);
  const mine = await asUser(t, alice).query(api.bankTransfer.myBankAccounts, {});
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({
    id,
    disabled: false,
    details: {
      label: "India (INR)",
      country: "IN",
      // Stored lower-case / stripped, so two spellings never read as two accounts.
      currency: "inr",
      accountNumber: "5010012345678",
      swift: "HDFCINBB",
    },
  });

  // Another user sees nothing of Alice's, and can't touch it.
  expect(await asUser(t, bob).query(api.bankTransfer.myBankAccounts, {})).toEqual([]);
  await expect(
    asUser(t, bob).mutation(api.bankTransfer.updateBankAccount, { id, ...SA }),
  ).rejects.toThrow(/not your bank account/);
  await expect(
    asUser(t, bob).mutation(api.bankTransfer.setBankAccountDisabled, { id, disabled: true }),
  ).rejects.toThrow(/not your bank account/);

  // An unauthenticated caller has no accounts and can add none.
  expect(await t.query(api.bankTransfer.myBankAccounts, {})).toEqual([]);
  await expect(t.mutation(api.bankTransfer.addBankAccount, INDIA)).rejects.toThrow(/forbidden/);
});

test("bad Collection account details are refused", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const add = (patch: Partial<typeof INDIA>) =>
    asUser(t, alice).mutation(api.bankTransfer.addBankAccount, { ...INDIA, ...patch });

  await expect(add({ label: "  " })).rejects.toThrow(/label/);
  await expect(add({ country: "India" })).rejects.toThrow(/2-letter/);
  await expect(add({ currency: "rupees" })).rejects.toThrow(/3-letter/);
  await expect(add({ accountHolder: "" })).rejects.toThrow(/required/);
  await expect(add({ bankName: "" })).rejects.toThrow(/required/);
  await expect(add({ accountNumber: "12" })).rejects.toThrow(/4–34/);
});

test("disabling a Collection account hides it from buyers but keeps the row", async () => {
  const t = convexTest(schema, modules);
  const { alice, accountId } = await fixture(t);

  expect(await asUser(t, alice).query(api.bankTransfer.bankOptions, { topicSlug: "hindi", lang: "en" })).toHaveLength(1);
  await asUser(t, alice).mutation(api.bankTransfer.setBankAccountDisabled, { id: accountId, disabled: true });
  expect(await asUser(t, alice).query(api.bankTransfer.bankOptions, { topicSlug: "hindi", lang: "en" })).toEqual([]);
  // Still the owner's, still editable — only retired from the picker.
  expect(await asUser(t, alice).query(api.bankTransfer.myBankAccounts, {})).toMatchObject([{ id: accountId, disabled: true }]);
});

test("the buyer's picker carries no account numbers, and offers nothing on a free Edition", async () => {
  const t = convexTest(schema, modules);
  const { bob, topicId, accountId } = await fixture(t);

  const options = await asUser(t, bob).query(api.bankTransfer.bankOptions, { topicSlug: "hindi", lang: "en" });
  // Region + currency only: a paid Edition's page must not be scrapeable for the
  // owner's bank details.
  expect(options).toEqual([{ id: accountId, label: "India (INR)", country: "IN", currency: "inr" }]);

  // Un-price the Edition — a free Edition needs no money path at all.
  await t.run(async (ctx) => {
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", "en"))
      .unique();
    await ctx.db.delete(listing!._id);
  });
  expect(await asUser(t, bob).query(api.bankTransfer.bankOptions, { topicSlug: "hindi", lang: "en" })).toEqual([]);
});

// ---- 3. requesting a transfer ------------------------------------------------

test("requesting a transfer stores the Edition, the account email, and the frozen price", async () => {
  const t = convexTest(schema, modules);
  const { bob, accountId } = await fixture(t);

  const reference = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });
  expect(reference).toMatch(/^MC-/);

  const mine = await asUser(t, bob).query(api.bankTransfer.myBankTransfer, { topicSlug: "hindi", lang: "en" });
  expect(mine).toMatchObject({
    reference,
    status: "awaiting",
    amount: 50_000,
    currency: "zar",
    // THE one read that returns bank details, and only to the buyer who asked.
    account: { accountNumber: "5010012345678", bankName: "HDFC Bank", currency: "inr" },
  });

  // The row is keyed to the buyer's ACCOUNT email, never a typed argument.
  const row = await t.run((ctx) =>
    ctx.db.query("bankTransfers").withIndex("by_reference", (q) => q.eq("reference", reference)).unique(),
  );
  expect(row).toMatchObject({ buyerEmail: "bob@example.com", buyerId: bob, lang: "en", status: "awaiting" });
});

test("requesting is refused when signed out, unpriced, or pointed at another owner's account", async () => {
  const t = convexTest(schema, modules);
  const { bob, accountId } = await fixture(t);
  // A second course, free, owned by someone else — with its own account.
  const carol = await seedUser(t, "carol@example.com");
  await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: carol, slug: "urdu", title: "Urdu", status: "completed" as const }),
  );
  const carolAccount = await asUser(t, carol).mutation(api.bankTransfer.addBankAccount, SA);

  await expect(
    t.mutation(api.bankTransfer.requestBankTransfer, { topicSlug: "hindi", lang: "en", bankAccountId: accountId }),
  ).rejects.toThrow(/sign in/);
  // Free Edition (urdu is unpriced).
  await expect(
    asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
      topicSlug: "urdu",
      lang: "en",
      bankAccountId: carolAccount,
    }),
  ).rejects.toThrow(/isn't for sale/);
  // An account that isn't the COURSE OWNER's — a buyer must not be pointed at any
  // account id they can name.
  await expect(
    asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
      topicSlug: "hindi",
      lang: "en",
      bankAccountId: carolAccount,
    }),
  ).rejects.toThrow(/isn't available/);
  // A retired account is no longer on offer either.
  await asUser(t, (await fixtureOwner(t))!).mutation(api.bankTransfer.setBankAccountDisabled, {
    id: accountId,
    disabled: true,
  });
  await expect(
    asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
      topicSlug: "hindi",
      lang: "en",
      bankAccountId: accountId,
    }),
  ).rejects.toThrow(/isn't available/);
});

// The fixture's owner id, re-resolved (the test above needs it after the fact).
async function fixtureOwner(t: ReturnType<typeof convexTest>) {
  const topic = await t.run((ctx) => ctx.db.query("topics").withIndex("by_slug", (q) => q.eq("slug", "hindi")).unique());
  return topic?.ownerId ?? null;
}

test("a repeat request returns the same reference, and can switch region", async () => {
  const t = convexTest(schema, modules);
  const { alice, bob, accountId } = await fixture(t);
  const saAccount = await asUser(t, alice).mutation(api.bankTransfer.addBankAccount, SA);

  const first = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });
  const again = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: saAccount,
  });
  // Same reference (the buyer may already have quoted it to their bank), now
  // pointing at the newly-chosen account. Two open references for one Edition
  // would be two payments the owner has to reconcile.
  expect(again).toBe(first);
  expect(await asUser(t, bob).query(api.bankTransfer.myBankTransfer, { topicSlug: "hindi", lang: "en" })).toMatchObject({
    reference: first,
    account: { label: "South Africa (ZAR)", bankName: "FNB" },
  });
  const all = await t.run((ctx) => ctx.db.query("bankTransfers").collect());
  expect(all).toHaveLength(1);
});

test("a transfer is readable only by the buyer who asked", async () => {
  const t = convexTest(schema, modules);
  const { bob, accountId } = await fixture(t);
  const carol = await seedUser(t, "carol@example.com");
  await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });

  // Another signed-in user reading the same Edition sees no transfer — the short
  // reference is guessable, so nothing hangs off possessing it.
  expect(await asUser(t, carol).query(api.bankTransfer.myBankTransfer, { topicSlug: "hindi", lang: "en" })).toBeNull();
  expect(await t.query(api.bankTransfer.myBankTransfer, { topicSlug: "hindi", lang: "en" })).toBeNull();
});

// ---- 4. approval: the grant --------------------------------------------------

test("the course owner approving a reference is what grants access", async () => {
  const t = convexTest(schema, modules);
  const { alice, bob, accountId } = await fixture(t);
  const reference = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });

  // Before: requesting granted nothing — the buyer is still on the Preview.
  expect(await asUser(t, bob).query(api.content.courseHeader, { topicSlug: "hindi" })).toMatchObject({
    role: "preview",
  });
  expect(await asUser(t, bob).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });

  await asUser(t, alice).mutation(api.bankTransfer.approveBankTransfer, { reference });

  // After: an ordinary Entitlement, so every downstream behaviour follows.
  expect(await asUser(t, bob).query(api.content.courseHeader, { topicSlug: "hindi" })).toMatchObject({
    role: "entitled",
  });
  expect(await asUser(t, bob).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    contentUrl: expect.any(String),
    locked: false,
  });
  expect(await asUser(t, bob).query(api.bankTransfer.myBankTransfer, { topicSlug: "hindi", lang: "en" })).toMatchObject({
    status: "approved",
  });
  // Provenance: the Entitlement names the transfer that bought it.
  const ent = await t.run((ctx) => ctx.db.query("entitlements").collect());
  expect(ent).toMatchObject([{ lang: "en", bankTransferRef: reference }]);
});

test("approval writes one Ledger row: the 50/50 split, already paid out, keyed to the reference", async () => {
  const t = convexTest(schema, modules);
  const { alice, bob, accountId, topicId } = await fixture(t);
  const reference = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });
  await asUser(t, alice).mutation(api.bankTransfer.approveBankTransfer, { reference });

  const ledger = await t.run((ctx) => ctx.db.query("ledger").collect());
  expect(ledger).toMatchObject([
    {
      topicId,
      lang: "en",
      sellerId: alice,
      buyerEmail: "bob@example.com",
      gross: 50_000,
      // No gateway took a cut, so net is the whole sale.
      fee: 0,
      net: 50_000,
      sellerShare: 25_000,
      platformShare: 25_000,
      bankTransferRef: reference,
      // The buyer paid into the owner's OWN account — nothing for the operator to
      // EFT, so the row is born `paid` and never appears in owedPayouts.
      status: "paid",
      payoutRef: reference,
    },
  ]);
  const admin = await seedAdmin(t, "admin@example.com");
  expect(await asUser(t, admin).query(api.ledger.owedPayouts, {})).toEqual([]);
  // …but the sale still counts as history, exactly like a PayFast sale.
  expect(await asUser(t, admin).query(api.sales.report, {})).toMatchObject([{ gross: 50_000, count: 1 }]);
});

test("a short payment records what actually arrived as the sale's cost", async () => {
  const t = convexTest(schema, modules);
  const { alice, bob, accountId } = await fixture(t);
  const reference = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });
  await expect(
    asUser(t, alice).mutation(api.bankTransfer.approveBankTransfer, { reference, receivedAmount: -1 }),
  ).rejects.toThrow(/non-negative/);

  // A cross-border transfer arrived R30 light after bank charges.
  await asUser(t, alice).mutation(api.bankTransfer.approveBankTransfer, {
    reference,
    receivedAmount: 47_000,
    note: "R470 received 27 Jul, correspondent bank fee",
  });

  // gross = fee + net holds on both rails, so sales reporting stays comparable,
  // and the split is computed on what actually arrived.
  expect(await t.run((ctx) => ctx.db.query("ledger").collect())).toMatchObject([
    { gross: 50_000, fee: 3_000, net: 47_000, sellerShare: 23_500, platformShare: 23_500 },
  ]);
  expect(await asUser(t, bob).query(api.bankTransfer.myBankTransfer, { topicSlug: "hindi", lang: "en" })).toMatchObject({
    status: "approved",
    note: "R470 received 27 Jul, correspondent bank fee",
  });
});

test("re-approving a reference is a no-op — never a second grant or a second Ledger row", async () => {
  const t = convexTest(schema, modules);
  const { alice, bob, accountId } = await fixture(t);
  const admin = await seedAdmin(t, "admin@example.com");
  const reference = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });

  await asUser(t, alice).mutation(api.bankTransfer.approveBankTransfer, { reference });
  await asUser(t, alice).mutation(api.bankTransfer.approveBankTransfer, { reference });
  // A second approver racing the first is the same no-op.
  await asUser(t, admin).mutation(api.bankTransfer.approveBankTransfer, { reference });

  expect(await t.run((ctx) => ctx.db.query("entitlements").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("ledger").collect())).toHaveLength(1);
});

test("only the course owner or the Admin may decide a reference", async () => {
  const t = convexTest(schema, modules);
  const { bob, accountId } = await fixture(t);
  const carol = await seedUser(t, "carol@example.com");
  const admin = await seedAdmin(t, "admin@example.com");
  const reference = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });

  // Not the buyer's own call to make, and certainly not a stranger's.
  await expect(asUser(t, bob).mutation(api.bankTransfer.approveBankTransfer, { reference })).rejects.toThrow(/forbidden/);
  await expect(asUser(t, carol).mutation(api.bankTransfer.approveBankTransfer, { reference })).rejects.toThrow(/forbidden/);
  await expect(t.mutation(api.bankTransfer.approveBankTransfer, { reference })).rejects.toThrow(/forbidden/);
  await expect(
    asUser(t, carol).mutation(api.bankTransfer.declineBankTransfer, { reference }),
  ).rejects.toThrow(/forbidden/);
  expect(await t.run((ctx) => ctx.db.query("entitlements").collect())).toEqual([]);

  // A reference nobody minted is a not-found, not a leak.
  await expect(
    asUser(t, admin).mutation(api.bankTransfer.approveBankTransfer, { reference: "MC-2222-3333" }),
  ).rejects.toThrow(/no payment with that reference/);

  // The Admin can act when an owner can't — and a sloppily-typed reference still
  // resolves.
  await asUser(t, admin).mutation(api.bankTransfer.approveBankTransfer, { reference: reference.toLowerCase().replace(/-/g, "") });
  expect(await t.run((ctx) => ctx.db.query("entitlements").collect())).toHaveLength(1);
});

test("declining closes the reference with a reason and grants nothing", async () => {
  const t = convexTest(schema, modules);
  const { alice, bob, accountId } = await fixture(t);
  const reference = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });

  await asUser(t, alice).mutation(api.bankTransfer.declineBankTransfer, {
    reference,
    note: "Nothing arrived by 27 Jul",
  });
  expect(await asUser(t, bob).query(api.bankTransfer.myBankTransfer, { topicSlug: "hindi", lang: "en" })).toMatchObject({
    status: "declined",
    note: "Nothing arrived by 27 Jul",
  });
  expect(await t.run((ctx) => ctx.db.query("entitlements").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("ledger").collect())).toEqual([]);
  // Still locked out, and approving a closed reference does nothing.
  await asUser(t, alice).mutation(api.bankTransfer.approveBankTransfer, { reference });
  expect(await asUser(t, bob).query(api.content.getLesson, { topicSlug: "hindi", key: "0002" })).toMatchObject({
    locked: true,
  });

  // The buyer may try again, which mints a FRESH reference.
  const retry = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });
  expect(retry).not.toBe(reference);
  expect(await asUser(t, bob).query(api.bankTransfer.myBankTransfer, { topicSlug: "hindi", lang: "en" })).toMatchObject({
    reference: retry,
    status: "awaiting",
  });
});

// ---- 5. the approval queue --------------------------------------------------

test("an owner's queue holds only their own courses' transfers; the Admin sees every one", async () => {
  const t = convexTest(schema, modules);
  const { alice, bob, accountId } = await fixture(t);
  const admin = await seedAdmin(t, "admin@example.com");
  const carol = await seedUser(t, "carol@example.com");

  // A second priced course, owned by Carol, bought by Bob.
  const urdu = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: carol, slug: "urdu", title: "Urdu", status: "completed" as const }),
  );
  await t.run((ctx) => ctx.db.insert("listings", { topicId: urdu, lang: "en", amount: 20_000, currency: "zar" }));
  const carolAccount = await asUser(t, carol).mutation(api.bankTransfer.addBankAccount, SA);

  const hindiRef = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "hindi",
    lang: "en",
    bankAccountId: accountId,
  });
  const urduRef = await asUser(t, bob).mutation(api.bankTransfer.requestBankTransfer, {
    topicSlug: "urdu",
    lang: "en",
    bankAccountId: carolAccount,
  });

  expect(await asUser(t, alice).query(api.bankTransfer.pendingTransfers, {})).toMatchObject([
    {
      reference: hindiRef,
      topicSlug: "hindi",
      courseTitle: "Hindi",
      lang: "en",
      buyerEmail: "bob@example.com",
      amount: 50_000,
      currency: "zar",
      accountLabel: "India (INR)",
      accountCurrency: "inr",
    },
  ]);
  expect(await asUser(t, carol).query(api.bankTransfer.pendingTransfers, {})).toMatchObject([{ reference: urduRef }]);
  // `all` is honoured for the Admin only — an owner asking for it still gets
  // exactly their own rows (scope is derived from the caller, never the argument).
  expect(
    (await asUser(t, admin).query(api.bankTransfer.pendingTransfers, { all: true })).map((r) => r.reference).sort(),
  ).toEqual([hindiRef, urduRef].sort());
  expect(await asUser(t, alice).query(api.bankTransfer.pendingTransfers, { all: true })).toMatchObject([
    { reference: hindiRef },
  ]);
  // The buyer has no queue at all.
  expect(await asUser(t, bob).query(api.bankTransfer.pendingTransfers, {})).toEqual([]);

  // Deciding removes it from the queue.
  await asUser(t, alice).mutation(api.bankTransfer.approveBankTransfer, { reference: hindiRef });
  expect(await asUser(t, alice).query(api.bankTransfer.pendingTransfers, {})).toEqual([]);
});
