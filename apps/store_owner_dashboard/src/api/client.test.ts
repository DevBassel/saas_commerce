import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, refreshSession, toApiError, tokenStorage } from "./client";
import { resetClientState } from "@/lib/client-reset";

vi.mock("@/lib/client-reset", () => ({
  resetClientState: vi.fn(),
}));

const responseFor = (
  config: InternalAxiosRequestConfig,
  status = 200,
  data: unknown = {},
) => ({
  data,
  status,
  statusText: status === 200 ? "OK" : "Error",
  headers: new AxiosHeaders(),
  config,
});

const unauthorizedError = (config: InternalAxiosRequestConfig): AxiosError =>
  new AxiosError("Unauthorized", "ERR_BAD_RESPONSE", config, undefined, {
    status: 401,
    statusText: "Unauthorized",
    headers: new AxiosHeaders(),
    data: {},
    config,
  });

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

  it("surfaces a machine-readable error code when the body has one", () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { code: "EMAIL_NOT_VERIFIED", message: "Email is not verified" },
      },
    };

    expect(toApiError(axiosError)).toEqual({
      message: "Email is not verified",
      statusCode: 401,
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  it("omits the code when the body has none", () => {
    const axiosError = {
      isAxiosError: true,
      response: { status: 400, data: { message: "bad request" } },
    };

    expect(toApiError(axiosError)).not.toHaveProperty("code");
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

describe("apiClient 401 refresh-and-replay", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(resetClientState).mockClear();
  });

  it("refreshes once and replays the original request", async () => {
    tokenStorage.setTokens("old-access", "refresh-1");
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { access_token: "new-access", refresh_token: "refresh-2" },
    });

    const seen: Array<string | undefined> = [];
    const adapter: AxiosAdapter = async (config) => {
      const auth = config.headers.get("Authorization");
      seen.push(typeof auth === "string" ? auth : undefined);
      if (auth === "Bearer new-access") return responseFor(config);
      throw unauthorizedError(config);
    };

    const response = await apiClient.get("/products", { adapter });

    expect(response.status).toBe(200);
    expect(seen).toEqual(["Bearer old-access", "Bearer new-access"]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("does not refresh or redirect for auth endpoints", async () => {
    tokenStorage.setTokens("old-access", "refresh-1");
    const post = vi.spyOn(axios, "post");
    const adapter: AxiosAdapter = async (config) => {
      throw unauthorizedError(config);
    };

    await expect(
      apiClient.post("/auth/login", {}, { adapter }),
    ).rejects.toBeDefined();

    expect(post).not.toHaveBeenCalled();
    expect(resetClientState).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBe("old-access");
  });

  it("clears tokens and redirects when the refresh cannot recover", async () => {
    tokenStorage.setTokens("old-access", "");
    const adapter: AxiosAdapter = async (config) => {
      throw unauthorizedError(config);
    };

    await expect(
      apiClient.get("/products", { adapter }),
    ).rejects.toBeDefined();

    expect(resetClientState).toHaveBeenCalledWith("/login");
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});

describe("apiClient request interceptor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("attaches x-tenant-slug and Authorization when present", async () => {
    vi.stubEnv("VITE_ALLOW_SUBDOMAIN", "false");
    window.history.replaceState(null, "", "/?tenant=my-store");
    tokenStorage.setTokens("access-1", "refresh-1");

    let seen: InternalAxiosRequestConfig | undefined;
    const adapter: AxiosAdapter = async (config) => {
      seen = config;
      return responseFor(config);
    };
    await apiClient.get("/products", { adapter });

    expect(seen?.headers.get("x-tenant-slug")).toBe("my-store");
    expect(seen?.headers.get("Authorization")).toBe("Bearer access-1");
  });

  it("omits both headers when there is no tenant or token", async () => {
    vi.stubEnv("VITE_ALLOW_SUBDOMAIN", "false");
    localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");

    let seen: InternalAxiosRequestConfig | undefined;
    const adapter: AxiosAdapter = async (config) => {
      seen = config;
      return responseFor(config);
    };
    await apiClient.get("/products", { adapter });

    expect(seen?.headers.get("x-tenant-slug")).toBeFalsy();
    expect(seen?.headers.get("Authorization")).toBeFalsy();
  });
});
