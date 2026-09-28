import axios, { isAxiosError } from "axios";
import { ApiError } from "next/dist/server/api-utils";
import { toast } from "sonner";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

export function handelError(error: unknown) {
  if (isAxiosError(error)) {
    if (error.response?.data.message) {
      return toast.error(
        Array.isArray(error.response?.data.message)
          ? error.response?.data.message.join(" | ")
          : error.response?.data.message,
      );
    }
  }
  return toast.error("Something went wrong, Try again.");
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
