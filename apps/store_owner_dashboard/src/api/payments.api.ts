import { apiClient } from "./client";
import type { StripeAccountStatus } from "@/types/payments";

export const paymentsApi = {
  getAccount: async (): Promise<StripeAccountStatus> => {
    const response = await apiClient.get<StripeAccountStatus>(
      "payments/stripe/account",
    );
    return response.data;
  },

  connect: async (): Promise<{ url: string }> => {
    const response = await apiClient.post<{ url: string }>(
      "payments/stripe/connect",
    );
    return response.data;
  },
};
