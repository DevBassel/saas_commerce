import { apiClient } from "./client";
import type {
  CurrencyChangeRequest,
  StoreCurrencyState,
} from "@/types/currency";

export const currencyApi = {
  getState: async (): Promise<StoreCurrencyState> => {
    const response = await apiClient.get<StoreCurrencyState>("store/currency");
    return response.data;
  },

  createRequest: async (payload: {
    requestedCurrency: string;
    reason?: string;
  }): Promise<CurrencyChangeRequest> => {
    const response = await apiClient.post<CurrencyChangeRequest>(
      "store/currency/requests",
      payload,
    );
    return response.data;
  },

  cancelRequest: async (id: number): Promise<CurrencyChangeRequest> => {
    const response = await apiClient.patch<CurrencyChangeRequest>(
      `store/currency/requests/${id}/cancel`,
    );
    return response.data;
  },
};
