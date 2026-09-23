import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authProvider, decodeJwt } from "./auth";
import { tokenStorage } from "@/api/client";

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const makeJwt = (payload: Record<string, unknown>): string =>
  `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.signature`;

const futureExp = Math.floor(Date.now() / 1000) + 3600;
const pastExp = Math.floor(Date.now() / 1000) - 3600;

describe("decodeJwt", () => {
  it("decodes a well-formed JWT payload", () => {
    const token = makeJwt({ id: 7, role: "owner", exp: futureExp });
    expect(decodeJwt(token)).toMatchObject({ id: 7, role: "owner" });
  });

  it("returns null for a malformed token", () => {
    expect(decodeJwt("not-a-jwt")).toBeNull();
  });
});

describe("authProvider.check", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns authenticated for a valid access token", async () => {
    tokenStorage.setSession(makeJwt({ type: "access", exp: futureExp }), "r", "a@b.c");
    await expect(authProvider.check({})).resolves.toMatchObject({
      authenticated: true,
    });
  });

  it("refreshes an expired access token and authenticates", async () => {
    tokenStorage.setSession(makeJwt({ type: "access", exp: pastExp }), "r", "a@b.c");
    vi.spyOn(axios, "post").mockResolvedValue({
      data: {
        access_token: makeJwt({ type: "access", exp: futureExp }),
        refresh_token: "r-2",
      },
    });

    await expect(authProvider.check({})).resolves.toMatchObject({
      authenticated: true,
    });
    expect(tokenStorage.getRefreshToken()).toBe("r-2");
  });

  it("clears the session when the refresh fails definitively", async () => {
    tokenStorage.setSession(makeJwt({ type: "access", exp: pastExp }), "r", "a@b.c");
    vi.spyOn(axios, "post").mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    const result = await authProvider.check({});

    expect(result).toMatchObject({ authenticated: false, redirectTo: "/login" });
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it("keeps tokens when the refresh fails transiently", async () => {
    tokenStorage.setSession(makeJwt({ type: "access", exp: pastExp }), "r", "a@b.c");
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    await expect(authProvider.check({})).resolves.toMatchObject({
      authenticated: false,
    });
    expect(tokenStorage.getRefreshToken()).toBe("r");
  });

  it("rejects a token without an exp claim when the refresh fails", async () => {
    tokenStorage.setSession(makeJwt({ type: "access" }), "r", "a@b.c");
    vi.spyOn(axios, "post").mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    await expect(authProvider.check({})).resolves.toMatchObject({
      authenticated: false,
    });
  });

  it("clears the session when the token is invalid and no refresh token exists", async () => {
    tokenStorage.setTokens(makeJwt({ type: "access", exp: pastExp }), "");
    const post = vi.spyOn(axios, "post");

    await expect(authProvider.check({})).resolves.toMatchObject({
      authenticated: false,
      redirectTo: "/login",
    });
    expect(post).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("rejects a refresh token used as an access token", async () => {
    tokenStorage.setSession(makeJwt({ type: "refresh", exp: futureExp }), "r", "a@b.c");
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    await expect(authProvider.check({})).resolves.toMatchObject({
      authenticated: false,
    });
  });
});

describe("authProvider.getPermissions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the role from the token", async () => {
    tokenStorage.setSession(makeJwt({ role: "admin", exp: futureExp }), "r", "a@b.c");
    await expect(authProvider.getPermissions?.({})).resolves.toBe("admin");
  });

  it("returns null when there is no token", async () => {
    await expect(authProvider.getPermissions?.({})).resolves.toBeNull();
  });
});
