import { apiClient } from "./client";

export type PlatformLoginPayload = {
  email: string;
  password: string;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

export const authApi = {
  loginPlatform: async (payload: PlatformLoginPayload): Promise<TokenPair> => {
    const response = await apiClient.post<TokenPair>(
      "auth/login/platform",
      payload
    );
    return response.data;
  },
};
