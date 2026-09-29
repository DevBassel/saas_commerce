import { apiClient } from "./client";
import type {
  PauseFlags,
  PlatformChargesResponse,
  PlatformPaymentOverview,
  PlatformPaymentTenant,
  PlatformPayoutsResponse,
} from "@/types/payments";

export const PAYMENTS_RESOURCE = "platform/payments";

export const paymentsApi = {
  list: async (): Promise<PlatformPaymentTenant[]> => {
    const response =
      await apiClient.get<PlatformPaymentTenant[]>(PAYMENTS_RESOURCE);
    return response.data;
  },

  get: async (id: string | number): Promise<PlatformPaymentOverview> => {
    const response = await apiClient.get<PlatformPaymentOverview>(
      `${PAYMENTS_RESOURCE}/${id}`,
    );
    return response.data;
  },

  listCharges: async (
    id: string | number,
    params: { page: number; limit: number },
  ): Promise<PlatformChargesResponse> => {
    const response = await apiClient.get<PlatformChargesResponse>(
      `${PAYMENTS_RESOURCE}/${id}/charges`,
      { params },
    );
    return response.data;
  },

  listPayouts: async (
    id: string | number,
    params: { limit: number; startingAfter?: string },
  ): Promise<PlatformPayoutsResponse> => {
    const response = await apiClient.get<PlatformPayoutsResponse>(
      `${PAYMENTS_RESOURCE}/${id}/payouts`,
      { params },
    );
    return response.data;
  },

  setPaymentsPaused: async (
    id: string | number,
    paused: boolean,
  ): Promise<PauseFlags> => {
    const response = await apiClient.patch<PauseFlags>(
      `${PAYMENTS_RESOURCE}/${id}/payments-paused`,
      { paused },
    );
    return response.data;
  },

  setPayoutsPaused: async (
    id: string | number,
    paused: boolean,
  ): Promise<PauseFlags> => {
    const response = await apiClient.patch<PauseFlags>(
      `${PAYMENTS_RESOURCE}/${id}/payouts-paused`,
      { paused },
    );
    return response.data;
  },
};
