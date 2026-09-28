// src/lib/axios.ts
import { authOptions } from "@/lib/auth";
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
    "/api/refresh",
    {},
    { headers: { "Content-Type": "application/json" } },
  );
  if (!data?.access_token) {
    throw new Error("Refresh response did not include an access token");
  }
  return data.access_token;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const config = err.config as RetryableConfig | undefined;

    // Only the browser can talk to the NextAuth refresh route, and each request
    // is retried at most once.
    if (
      typeof window === "undefined" ||
      err.response?.status !== 401 ||
      !config ||
      config._retry
    ) {
      console.log(
        "🚀 ~ apiClient.ts:71 ~ err.response?.data:",
        err.response?.data,
      );

      return Promise.reject(err);
    }

    const { session } = await getClientSession();
    const currentToken = session?.user?.accessToken;

    // No session, or the access token is still valid: this 401 is not an
    // expiry and refreshing would not help.
    if (!currentToken || !isExpired(currentToken)) {
      console.log(
        "🚀 ~ apiClient.ts:85 ~ err.response?.data:",
        err.response?.data,
      );

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
      console.log("🚀 ~ apiClient.ts:104 ~ error:", error);

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
    tenantSlug = (await headers()).get("host")?.split(".")[0];
  } else {
    session = await getSession();
    tenantSlug = window.location.hostname.split(".")[0];
  }

  return {
    session,
    tenantSlug,
    isServer,
  };
}
