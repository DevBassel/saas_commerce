import { apiClient } from "./client";

export type TenantLoginPayload = {
  email: string;
  password: string;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

export type TenantLoginResponse = TokenPair & {
  id: number;
  email: string;
  verified: boolean;
};

export type RegisterUserPayload = {
  name: string;
  email: string;
  password: string;
};

export type RegisterUserResponse = {
  success: boolean;
  msg: string;
};

export const authApi = {
  loginTenant: async (payload: TenantLoginPayload): Promise<TenantLoginResponse> => {
    const response = await apiClient.post<TenantLoginResponse>(
      "auth/login",
      payload,
    );
    return response.data;
  },

  registerTenantUser: async (
    payload: RegisterUserPayload,
  ): Promise<RegisterUserResponse> => {
    const response = await apiClient.post<RegisterUserResponse>(
      "auth/register",
      payload,
    );
    return response.data;
  },
};
