import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { jwtDecode } from "jwt-decode";

import {
  API_URL,
  REFRESH_TOKEN_KEY,
  TOKEN_KEY,
  USER_EMAIL_KEY,
} from "./constants";

export type ApiError = {
  message: string;
  statusCode: number;
};

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getEmail: () => localStorage.getItem(USER_EMAIL_KEY),
  setSession: (accessToken: string, refreshToken: string, email: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_EMAIL_KEY, email);
  },
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
  },
};

const AUTH_ENDPOINTS = ["auth/login", "auth/register", "auth/refresh"];
const REFRESH_ENDPOINT = "auth/refresh";

const getTenantHeaderValue = (): string =>
  window.location.hostname.split(".")[0];

const isAuthRequest = (url?: string): boolean =>
  !!url && AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

const unauthenticatedRedirect = () => {
  tokenStorage.clear();
  window.location.assign("/login");
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const tenantSubdomain = getTenantHeaderValue();

  if (!tenantSubdomain) window.location.replace(`${API_URL}`);

  config.headers.set("x-tenant-slug", tenantSubdomain);
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const decodeExp = (token: string): number | undefined => {
  try {
    const payload = jwtDecode<{ exp?: number }>(token);
    return typeof payload.exp === "number" ? payload.exp : undefined;
  } catch {
    return undefined;
  }
};

let refreshPromise: Promise<string | null> | null = null;

export const refreshSession = (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  const run = async (): Promise<string | null> => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) return null; // definitive: nothing to refresh with

    try {
      const { data } = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(
        `${API_URL}/${REFRESH_ENDPOINT}`,
        { refresh_token: refreshToken },
        { headers: { "x-tenant-slug": getTenantHeaderValue() } },
      );
      tokenStorage.setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      if (status === 401 || status === 403) tokenStorage.clear(); // definitive
      return null; // transient: tokens kept
    }
  };

  refreshPromise = run().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !isAuthRequest(config.url)
    ) {
      config._retry = true;

      const token = tokenStorage.getAccessToken();
      const exp = token ? decodeExp(token) : undefined;
      const isExpired = exp === undefined || exp * 1000 <= Date.now();
      void isExpired; // classification only; refresh runs on any 401

      const accessToken = await refreshSession();

      if (accessToken) {
        config.headers.set("Authorization", `Bearer ${accessToken}`);
        return apiClient.request(config);
      }

      // Definitive failure cleared the refresh token; transient failure keeps it.
      if (!tokenStorage.getRefreshToken()) unauthenticatedRedirect();
    }

    return Promise.reject(error);
  },
);

const extractMessage = (error: AxiosError): string => {
  const data = error.response?.data as
    | { message?: string | string[] }
    | undefined;

  if (!data?.message) {
    return `Request failed (${error.response?.status ?? "network error"})`;
  }
  if (Array.isArray(data.message)) {
    return data.message.join(", ");
  }
  return data.message;
};

export const toApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    return {
      message: extractMessage(error),
      statusCode: error.response?.status ?? 0,
    };
  }
  return {
    message: error instanceof Error ? error.message : "Unknown error",
    statusCode: 0,
  };
};
