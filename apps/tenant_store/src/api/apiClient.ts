// src/lib/axios.ts
import { authOptions } from "@/lib/auth";
import { getTenantSlugFromHost } from "@/lib/tenant/host";
import { getBrowserTenantSlug, withTenantParam } from "@/lib/tenant/url";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getSession, signOut } from "next-auth/react";
import { jwtDecode } from "jwt-decode";
const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL;
export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const { session, tenantSlug } = await getClientSession();
  if (session?.user?.accessToken) {
    config.headers.Authorization = `Bearer ${session.user.accessToken}`;
  }
  if (tenantSlug) {
    config.headers["x-tenant-slug"] = tenantSlug;
  }
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/**
 * Shared in-flight refresh so that a burst of concurrent 401s only rotates the
 * refresh token once (the backend rotates its `jti`, so parallel refreshes would
 * revoke each other).
 */
let refreshPromise: Promise<string> | null = null;

function isExpired(accessToken?: string | null) {
  if (!accessToken) return true;
  try {
    const { exp } = jwtDecode<{ exp?: number }>(accessToken);
    return typeof exp === "number" ? exp <= Date.now() / 1000 : false;
  } catch {
    return true;
  }
}

async function requestNewAccessToken() {
  const { data } = await axios.post<{ access_token?: string }>(
    withTenantParam("/api/refresh", getBrowserTenantSlug()),
    {},
    { headers: { "Content-Type": "application/json" } },
  );
  if (!data?.access_token) {
    throw new Error("Refresh response did not include an access token");
  }
  return data.access_token;
}

/** Backend error body (Nest `HttpException` with a `{ code, message }` shape). */
type ApiErrorBody = { code?: string; message?: string };

function isEmailNotVerified(err: AxiosError) {
  return (
    (err.response?.data as ApiErrorBody | undefined)?.code ===
    "EMAIL_NOT_VERIFIED"
  );
}

/**
 * Browser-only redirect. The server-rendered path (initial navigation to a
 * protected page) is covered proactively by the proxy, so here we only react to
 * requests issued after a page has loaded.
 */
function redirectToVerifyEmail() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/verify-email") return;
  window.location.assign(withTenantParam("/verify-email", getBrowserTenantSlug()));
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    // Any tenant route rejected because the account's email is not verified
    // sends the browser to the verification page instead of surfacing a raw
    // error. The page reads the address from the session.
    if (isEmailNotVerified(err)) {
      redirectToVerifyEmail();
      return Promise.reject(err);
    }

    const config = err.config as RetryableConfig | undefined;

    // Only the browser can talk to the NextAuth refresh route, and each request
    // is retried at most once.
    if (
      typeof window === "undefined" ||
      err.response?.status !== 401 ||
      !config ||
      config._retry
    ) {
      return Promise.reject(err);
    }

    const { session } = await getClientSession();
    const currentToken = session?.user?.accessToken;

    // No session, or the access token is still valid: this 401 is not an
    // expiry and refreshing would not help.
    if (!currentToken || !isExpired(currentToken)) {
      return Promise.reject(err);
    }

    config._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = requestNewAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const accessToken = await refreshPromise;
      config.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(config);
    } catch (error) {
      // A 401 means the refresh token is unusable; clear the stale session so
      // the user is sent back through sign-in on the next protected navigation.
      // Transient failures (network/5xx) keep the session intact for a retry.
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await signOut({ redirect: false });
      }
      return Promise.reject(error);
    }
  },
);
async function getClientSession() {
  const isServer = typeof window === "undefined";
  let session = null;
  let tenantSlug = null;
  if (isServer) {
    const { getServerSession } = await import("next-auth");
    const { headers } = await import("next/headers");
    session = await getServerSession(authOptions);
    const requestHeaders = await headers();
    tenantSlug =
      requestHeaders.get("x-tenant-slug") ??
      getTenantSlugFromHost(requestHeaders.get("host"));
  } else {
    session = await getSession();
    tenantSlug = getBrowserTenantSlug();
  }

  return {
    session,
    tenantSlug,
    isServer,
  };
}
