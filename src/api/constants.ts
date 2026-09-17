export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:4000/api/v1";

export const TOKEN_KEY = "tenant-access-token";
export const USER_EMAIL_KEY = "tenant-email";
export const REFRESH_TOKEN_KEY = "tenant-refresh-token";
