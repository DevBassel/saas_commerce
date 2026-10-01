import { apiClient } from "./client";
import type { CurrencyChangeRequest } from "@/types/currency-request";

export const CURRENCY_REQUESTS_RESOURCE = "platform/currency-requests";

export const currencyRequestsApi = {
  list: async (status?: string): Promise<CurrencyChangeRequest[]> => {
    const response = await apiClient.get<CurrencyChangeRequest[]>(
      CURRENCY_REQUESTS_RESOURCE,
      { params: status ? { status } : undefined },
    );
    return response.data;
  },

  approve: async (id: number): Promise<CurrencyChangeRequest> => {
    const response = await apiClient.patch<CurrencyChangeRequest>(
      `${CURRENCY_REQUESTS_RESOURCE}/${id}/approve`,
    );
    return response.data;
  },

  reject: async (
    id: number,
    reviewNote: string,
  ): Promise<CurrencyChangeRequest> => {
    const response = await apiClient.patch<CurrencyChangeRequest>(
      `${CURRENCY_REQUESTS_RESOURCE}/${id}/reject`,
      { reviewNote },
    );
    return response.data;
  },
};
