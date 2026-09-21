import axios, { AxiosError, type AxiosInstance } from "axios";

import { API_URL, REFRESH_TOKEN_KEY, TOKEN_KEY, USER_EMAIL_KEY } from "./constants";

export type ApiError = {
  message: string;
  statusCode: number;
};

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  setSession: (accessToken: string, refreshToken: string, email: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_EMAIL_KEY, email);
  },
  getEmail: () => localStorage.getItem(USER_EMAIL_KEY),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
  },
};

const unauthenticatedRedirect = () => {
  tokenStorage.clear();
  window.location.assign("/login");
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      unauthenticatedRedirect();
    }
    return Promise.reject(error);
  }
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
