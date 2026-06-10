import { describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { bearerToken, jwksUrl, makeUserResolver } from "./auth.js";

const req = (headers: Record<string, string> = {}) => new Request("https://app/api/topics", { headers });

// Mirrors the Neon Auth shape: the base URL is a path on the branch endpoint and
// tokens are issued with `iss` = that URL's origin.
const AUTH_URL = "https://ep-test.neonauth.example.neon.tech/neondb/auth";
const ISSUER = "https://ep-test.neonauth.example.neon.tech";

describe("bearerToken", () => {
  it("extracts the token from a Bearer Authorization header", () => {
    expect(bearerToken(req({ authorization: "Bearer abc.def.ghi" }))).toBe("abc.def.ghi");
  });

  it("is undefined when the header is missing or not a bearer scheme", () => {
    expect(bearerToken(req())).toBeUndefined();
    expect(bearerToken(req({ authorization: "Basic xyz" }))).toBeUndefined();
  });
});

describe("jwksUrl", () => {
  it("appends the well-known path to the auth base URL", () => {
    expect(jwksUrl(AUTH_URL)).toBe(`${AUTH_URL}/.well-known/jwks.json`);
    expect(jwksUrl(`${AUTH_URL}/`)).toBe(`${AUTH_URL}/.well-known/jwks.json`);
  });
});

describe("makeUserResolver", () => {
  type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  const signToken = async (privateKey: PrivateKey, issuer: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("user-123")
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

  it("returns undefined (dev fallback) when Neon Auth is not configured", async () => {
    const resolve = makeUserResolver({});
    expect(await resolve(req({ authorization: "Bearer anything" }))).toBeUndefined();
  });

  it("returns the token subject when the JWT verifies against the auth origin", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const token = await signToken(privateKey, ISSUER);
    const getKey: JWTVerifyGetKey = async () => publicKey;

    const resolve = makeUserResolver({ NEON_AUTH_URL: AUTH_URL }, getKey);
    expect(await resolve(req({ authorization: `Bearer ${token}` }))).toBe("user-123");
  });

  it("rejects a token from a different issuer", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const token = await signToken(privateKey, "https://evil.example");
    const getKey: JWTVerifyGetKey = async () => publicKey;

    const resolve = makeUserResolver({ NEON_AUTH_URL: AUTH_URL }, getKey);
    expect(await resolve(req({ authorization: `Bearer ${token}` }))).toBeUndefined();
  });

  it("returns undefined for a missing or unverifiable token", async () => {
    const { publicKey } = await generateKeyPair("RS256");
    const getKey: JWTVerifyGetKey = async () => publicKey;
    const resolve = makeUserResolver({ NEON_AUTH_URL: AUTH_URL }, getKey);

    expect(await resolve(req())).toBeUndefined();
    expect(await resolve(req({ authorization: "Bearer not.a.jwt" }))).toBeUndefined();
  });
});
