import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

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

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);

  refreshPromise = axios
    .post<{ access_token: string; refresh_token: string }>(
      `${API_URL}/${REFRESH_ENDPOINT}`,
      { refresh_token: refreshToken },
      { headers: { "x-tenant-slug": getTenantHeaderValue() } },
    )
    .then((response) => {
      tokenStorage.setTokens(
        response.data.access_token,
        response.data.refresh_token,
      );
      return response.data.access_token;
    })
    .catch(() => {
      tokenStorage.clear();
      return null;
    })
    .finally(() => {
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

      const accessToken = await refreshAccessToken();

      if (accessToken) {
        config.headers.set("Authorization", `Bearer ${accessToken}`);
        return apiClient.request(config);
      }

      unauthenticatedRedirect();
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
