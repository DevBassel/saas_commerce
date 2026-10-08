"use client";

import { isAxiosError } from "axios";
import { toast } from "sonner";

/**
 * Client-only error toast. Kept separate from `handleError.ts` (pure
 * `toApiError`) so Server Components never pull `sonner` into their graph.
 */
export function handleError(error: unknown) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (message) {
      return toast.error(
        Array.isArray(message) ? message.join(" | ") : message,
      );
    }
  }
  return toast.error("Something went wrong, Try again.");
}
