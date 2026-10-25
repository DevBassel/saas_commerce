import { apiClient } from "./client";

export type HealthResponse = {
  status: "ok" | "degraded";
  db: boolean;
  r2: boolean;
  cache: {
    enabled: boolean;
    driver: "redis";
    connected: boolean;
  };
};

export const healthApi = {
  getHealth: async (): Promise<HealthResponse> => {
    const { data } = await apiClient.get<HealthResponse>("health");
    return data;
  },
};