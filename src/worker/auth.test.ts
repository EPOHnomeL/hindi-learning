import { describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { bearerToken, makeUserResolver } from "./auth.js";

const req = (headers: Record<string, string> = {}) => new Request("https://app/api/topics", { headers });

describe("bearerToken", () => {
  it("extracts the token from a Bearer Authorization header", () => {
    expect(bearerToken(req({ authorization: "Bearer abc.def.ghi" }))).toBe("abc.def.ghi");
  });

  it("is undefined when the header is missing or not a bearer scheme", () => {
    expect(bearerToken(req())).toBeUndefined();
    expect(bearerToken(req({ authorization: "Basic xyz" }))).toBeUndefined();
  });
});

describe("makeUserResolver", () => {
  it("returns undefined (dev fallback) when Neon Auth is not configured", async () => {
    const resolve = makeUserResolver({});
    expect(await resolve(req({ authorization: "Bearer anything" }))).toBeUndefined();
  });

  it("returns the token subject when the JWT verifies", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const getKey: JWTVerifyGetKey = async () => publicKey;

    const resolve = makeUserResolver({ STACK_PROJECT_ID: "proj" }, getKey);
    expect(await resolve(req({ authorization: `Bearer ${token}` }))).toBe("user-123");
  });

  it("returns undefined for a missing or unverifiable token", async () => {
    const { publicKey } = await generateKeyPair("RS256");
    const getKey: JWTVerifyGetKey = async () => publicKey;
    const resolve = makeUserResolver({ STACK_PROJECT_ID: "proj" }, getKey);

    expect(await resolve(req())).toBeUndefined();
    expect(await resolve(req({ authorization: "Bearer not.a.jwt" }))).toBeUndefined();
  });
});
