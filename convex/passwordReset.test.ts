/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Same throwaway RS256 key and env as auth.test.ts: Convex Auth signs a session
// JWT on every accepted sign-in, and the reset flow ends in one. `SITE_URL` is
// needed too, because the library builds a (here unused) redirect destination for
// every email provider send before it calls `sendVerificationRequest`.
beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.JWT_PRIVATE_KEY = privateKey as string;
  process.env.CONVEX_SITE_URL = "https://example.convex.site";
  process.env.SITE_URL = "https://example.com";
  process.env.AUTH_GOOGLE_ID = "test-google-client-id";
  process.env.AUTH_GOOGLE_SECRET = "test-google-client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.INVITE_FROM_EMAIL;
});

const PASSWORD = "hunter2-strong";
const NEW_PASSWORD = "brand-new-secret-9";

function stubFetch() {
  const mock = vi.fn(async () => new Response(JSON.stringify({ id: "re_123" }), { status: 200 }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

const signUp = (t: ReturnType<typeof convexTest>, email: string, password = PASSWORD) =>
  t.action(api.auth.signIn, { provider: "password", params: { email, password, flow: "signUp" } });

const requestReset = (t: ReturnType<typeof convexTest>, email: string) =>
  t.action(api.auth.signIn, { provider: "password", params: { email, flow: "reset" } });

const verifyReset = (t: ReturnType<typeof convexTest>, email: string, code: string, newPassword: string) =>
  t.action(api.auth.signIn, {
    provider: "password",
    params: { email, code, newPassword, flow: "reset-verification" },
  });

// The one and only way to learn a code: read it back off the email that was sent.
// Nothing hands the OTP to the caller (the plaintext is never stored either, only
// its hash), so the test walks the same rail the user does.
function otpFrom(fetchMock: ReturnType<typeof stubFetch>): string {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { text: string };
  const code = body.text.match(/\b\d{8}\b/)?.[0];
  expect(code, `no 8-digit code in the sent email: ${body.text}`).toBeDefined();
  return code!;
}

// `retrieveAccountWithCredentials` is the library's own password check, one layer
// under `signIn`. Asserting on its verdict says WHICH way the attempt failed
// ("InvalidSecret" = the account is there and the password is wrong), which a
// thrown "Invalid credentials" from the action would not distinguish.
const checkPassword = (t: ReturnType<typeof convexTest>, email: string, secret: string) =>
  t.mutation(internal.auth.store, {
    args: { type: "retrieveAccountWithCredentials", provider: "password", account: { id: email, secret } },
  });

const counts = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => ({
    users: (await ctx.db.query("users").collect()).length,
    accounts: (await ctx.db.query("authAccounts").collect()).length,
  }));

test("a forgotten password is recoverable end to end: emailed code, new password, and the old one is dead", async () => {
  process.env.RESEND_API_KEY = "re-test";
  process.env.INVITE_FROM_EMAIL = "My Course <no-reply@example.com>";
  const t = convexTest(schema, modules);
  await signUp(t, "locked-out@example.com");
  const fetchMock = stubFetch();

  await requestReset(t, "locked-out@example.com");
  const code = otpFrom(fetchMock);

  // Verification signs the user straight in, which is the whole point: they are
  // back in the app without a second trip through the sign-in form.
  const result = await verifyReset(t, "locked-out@example.com", code, NEW_PASSWORD);
  expect(result).toMatchObject({ tokens: expect.anything() });

  expect(await checkPassword(t, "locked-out@example.com", NEW_PASSWORD)).toMatchObject({
    user: { email: "locked-out@example.com" },
  });
  // The lockout this ticket exists for is only really over once the old secret
  // stops working, so that is the assertion, not just "the new one works".
  expect(await checkPassword(t, "locked-out@example.com", PASSWORD)).toBe("InvalidSecret");
});

test("a wrong code is refused and the password is left exactly as it was", async () => {
  process.env.RESEND_API_KEY = "re-test";
  process.env.INVITE_FROM_EMAIL = "My Course <no-reply@example.com>";
  const t = convexTest(schema, modules);
  await signUp(t, "typo@example.com");
  const fetchMock = stubFetch();
  await requestReset(t, "typo@example.com");
  const code = otpFrom(fetchMock);

  await expect(verifyReset(t, "typo@example.com", "00000000", NEW_PASSWORD)).rejects.toThrow();

  expect(await checkPassword(t, "typo@example.com", NEW_PASSWORD)).toBe("InvalidSecret");
  expect(await checkPassword(t, "typo@example.com", PASSWORD)).toMatchObject({
    user: { email: "typo@example.com" },
  });
  // And the real code is still usable, so a fat-fingered digit costs a retry and
  // not a whole new email.
  await verifyReset(t, "typo@example.com", code, NEW_PASSWORD);
  expect(await checkPassword(t, "typo@example.com", NEW_PASSWORD)).toMatchObject({
    user: { email: "typo@example.com" },
  });
});

test("a reset for an address with no account creates nothing and sends nothing", async () => {
  process.env.RESEND_API_KEY = "re-test";
  process.env.INVITE_FROM_EMAIL = "My Course <no-reply@example.com>";
  const t = convexTest(schema, modules);
  await signUp(t, "real@example.com");
  const before = await counts(t);
  const fetchMock = stubFetch();

  // The Allowlist gate lives in `createOrUpdateUser`, and the reset rail never
  // reaches it. This is the assertion that reset cannot become a back door for
  // account creation: the row counts do not move.
  await expect(requestReset(t, "nobody@example.com")).rejects.toThrow();

  expect(await counts(t)).toEqual(before);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("with RESEND_API_KEY unset the request logs and no-ops instead of throwing", async () => {
  const t = convexTest(schema, modules);
  await signUp(t, "local-dev@example.com");
  const fetchMock = stubFetch();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  // Same convention as `sendInvite`: a deployment without Resend provisioned must
  // still boot and still let the rest of the flow be walked.
  await expect(requestReset(t, "local-dev@example.com")).resolves.toBeDefined();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
