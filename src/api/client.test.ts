import { describe, expect, it } from "vitest";

import { toApiError, tokenStorage } from "./client";

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
