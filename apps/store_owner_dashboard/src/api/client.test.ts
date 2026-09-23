import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { refreshSession, toApiError, tokenStorage } from "./client";

describe("toApiError", () => {
  it("maps a plain Error to a message with statusCode 0", () => {
    expect(toApiError(new Error("boom"))).toEqual({
      message: "boom",
      statusCode: 0,
    });
  });

  it("falls back to 'Unknown error' for non-Error values", () => {
    expect(toApiError("nope")).toEqual({
      message: "Unknown error",
      statusCode: 0,
    });
  });

  it("extracts and joins an array message from an axios error", () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 400,
        data: { message: ["name is required", "sku is required"] },
      },
    };

    expect(toApiError(axiosError)).toEqual({
      message: "name is required, sku is required",
      statusCode: 400,
    });
  });

  it("falls back to a request-failed message when the body has no message", () => {
    const axiosError = { isAxiosError: true, response: { status: 500, data: {} } };
    expect(toApiError(axiosError)).toEqual({
      message: "Request failed (500)",
      statusCode: 500,
    });
  });
});

describe("tokenStorage", () => {
  it("stores, reads and clears the session", () => {
    tokenStorage.setSession("access", "refresh", "user@example.com");
    expect(tokenStorage.getAccessToken()).toBe("access");
    expect(tokenStorage.getRefreshToken()).toBe("refresh");
    expect(tokenStorage.getEmail()).toBe("user@example.com");

    tokenStorage.setTokens("access-2", "refresh-2");
    expect(tokenStorage.getAccessToken()).toBe("access-2");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-2");
    expect(tokenStorage.getEmail()).toBe("user@example.com");

    tokenStorage.clear();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(tokenStorage.getEmail()).toBeNull();
  });
});

describe("refreshSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null without calling the API when no refresh token exists", async () => {
    const post = vi.spyOn(axios, "post");

    await expect(refreshSession()).resolves.toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("stores and returns the refreshed access token", async () => {
    tokenStorage.setTokens("old-access", "refresh-1");
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { access_token: "new-access", refresh_token: "refresh-2" },
    });

    await expect(refreshSession()).resolves.toBe("new-access");

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe(
      "http://localhost:4000/api/v1/auth/refresh",
    );
    expect(post.mock.calls[0][1]).toEqual({ refresh_token: "refresh-1" });
    expect(tokenStorage.getAccessToken()).toBe("new-access");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-2");
  });

  it("shares one in-flight refresh across concurrent callers", async () => {
    tokenStorage.setTokens("old-access", "refresh-1");
    let resolvePost: (value: unknown) => void = () => {};
    const post = vi.spyOn(axios, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }) as ReturnType<typeof axios.post>,
    );

    const first = refreshSession();
    const second = refreshSession();

    expect(post).toHaveBeenCalledTimes(1);

    resolvePost({
      data: { access_token: "new-access", refresh_token: "refresh-2" },
    });

    await expect(first).resolves.toBe("new-access");
    await expect(second).resolves.toBe("new-access");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("clears the session when the refresh is rejected with 401", async () => {
    tokenStorage.setSession("old-access", "refresh-1", "user@example.com");
    vi.spyOn(axios, "post").mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    await expect(refreshSession()).resolves.toBeNull();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(tokenStorage.getEmail()).toBeNull();
  });

  it("keeps the session when the refresh fails transiently", async () => {
    tokenStorage.setSession("old-access", "refresh-1", "user@example.com");
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));

    await expect(refreshSession()).resolves.toBeNull();

    expect(tokenStorage.getAccessToken()).toBe("old-access");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-1");
  });
});
