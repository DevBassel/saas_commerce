import { apiClient } from "./client";

export type TenantLoginPayload = {
  email: string;
  password: string;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

export const authApi = {
  loginTenant: async (payload: TenantLoginPayload): Promise<TokenPair> => {
    const response = await apiClient.post<TokenPair>("auth/login", payload);
    return response.data;
  },
};
