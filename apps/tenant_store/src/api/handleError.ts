import axios from "axios";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * Local error shape. Previously imported from `next/dist/server/api-utils`,
 * which is an internal Next path; a local type removes that coupling and keeps
 * this module importable from Server Components.
 */
export interface ApiError {
  name: "ApiError";
  message: string;
  statusCode: number;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { name?: unknown }).name === "ApiError" &&
    typeof (value as { statusCode?: unknown }).statusCode === "number"
  );
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;

  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status ?? 0;
    const data = error.response?.data as
      | { message?: unknown; code?: unknown }
      | string
      | undefined;

    const rawMessage =
      typeof data === "string"
        ? data
        : (data as { message?: unknown } | undefined)?.message;

    let message: string;
    if (Array.isArray(rawMessage)) {
      message = rawMessage.join(" | ");
    } else if (typeof rawMessage === "string" && rawMessage.trim()) {
      message = rawMessage;
    } else if (error.message) {
      message = error.message;
    } else {
      message = FALLBACK_MESSAGE;
    }

    return { name: "ApiError", message, statusCode };
  }

  return {
    name: "ApiError",
    message:
      error instanceof Error && error.message
        ? error.message
        : FALLBACK_MESSAGE,
    statusCode: 0,
  };
}
