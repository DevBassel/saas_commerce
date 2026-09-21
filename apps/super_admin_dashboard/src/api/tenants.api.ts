import { apiClient } from "./client";
import type { Tenant } from "@/types/tenant";

export type RegisterStorePayload = {
  name: string;
  email: string;
  password: string;
  storeName: string;
  storeSlug: string;
  subdomain?: string;
};

export type RegisterStoreResponse = {
  access_token: string;
  refresh_token: string;
};

export const TENANTS_RESOURCE = "platform/tenants";
export const REGISTER_STORE_RESOURCE = "auth/register-store";

export const tenantsApi = {
  list: async (): Promise<Tenant[]> => {
    const response = await apiClient.get<Tenant[]>(TENANTS_RESOURCE);
    return response.data;
  },

  get: async (id: string | number): Promise<Tenant> => {
    const response = await apiClient.get<Tenant>(`${TENANTS_RESOURCE}/${id}`);
    return response.data;
  },

  toggleActive: async (id: string | number): Promise<Tenant> => {
    const response = await apiClient.patch<Tenant>(
      `${TENANTS_RESOURCE}/${id}/toggle-active`,
    );
    return response.data;
  },

  registerStore: async (
    payload: RegisterStorePayload,
  ): Promise<RegisterStoreResponse> => {
    const response = await apiClient.post<RegisterStoreResponse>(
      REGISTER_STORE_RESOURCE,
      payload,
    );
    return response.data;
  },
};
