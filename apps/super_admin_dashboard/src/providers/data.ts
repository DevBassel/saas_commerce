import type { DataProvider } from "@refinedev/core";

import { apiClient, toApiError } from "@/api/client";
import { API_URL } from "@/api/constants";
import {
  tenantsApi,
  TENANTS_RESOURCE,
  REGISTER_STORE_RESOURCE,
  type RegisterStorePayload,
} from "@/api/tenants.api";
import { applyFilters, applySorters, applyPagination } from "@/api/query-utils";

const fetchList = async (resource: string): Promise<Record<string, unknown>[]> => {
  if (resource === TENANTS_RESOURCE) {
    return (await tenantsApi.list()) as unknown as Record<string, unknown>[];
  }
  const response = await apiClient.get<Record<string, unknown>[]>(resource);
  return Array.isArray(response.data) ? response.data : [];
};

const fetchOne = async (
  resource: string,
  id: string | number
): Promise<Record<string, unknown>> => {
  if (resource === TENANTS_RESOURCE) {
    return (await tenantsApi.get(id)) as unknown as Record<string, unknown>;
  }
  const response = await apiClient.get<Record<string, unknown>>(
    `${resource}/${id}`
  );
  return response.data;
};

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters }) => {
    try {
      const list = await fetchList(resource);
      const filtered = applyFilters(list, filters);
      const sorted = applySorters(filtered, sorters);
      const paged = applyPagination(sorted, pagination);
      return {
        data: paged.data as never[],
        total: paged.total,
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  getOne: async ({ resource, id }) => {
    try {
      const data = await fetchOne(resource, id);
      return { data: data as never };
    } catch (error) {
      throw toApiError(error);
    }
  },

  getMany: async ({ resource, ids }) => {
    try {
      const list = await fetchList(resource);
      return {
        data: list.filter((item) => ids.includes(item.id as never)) as never[],
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  create: async ({ resource, variables }) => {
    try {
      if (resource === REGISTER_STORE_RESOURCE) {
        const store = await tenantsApi.registerStore(
          variables as RegisterStorePayload
        );
        return { data: store as never };
      }
      const response = await apiClient.post<Record<string, unknown>>(
        resource,
        variables
      );
      return { data: response.data as never };
    } catch (error) {
      throw toApiError(error);
    }
  },

  update: async ({ resource, id, variables }) => {
    try {
      const response = await apiClient.patch<Record<string, unknown>>(
        `${resource}/${id}`,
        variables
      );
      return { data: response.data as never };
    } catch (error) {
      throw toApiError(error);
    }
  },

  deleteOne: async ({ resource, id }) => {
    try {
      const response = await apiClient.delete<Record<string, unknown>>(
        `${resource}/${id}`
      );
      return { data: (response.data ?? {}) as never };
    } catch (error) {
      throw toApiError(error);
    }
  },

  getApiUrl: () => API_URL,

  custom: async ({ url, method, payload, query, headers }) => {
    try {
      const response = await apiClient.request<Record<string, unknown>>({
        url,
        method,
        data: payload,
        params: query,
        headers: headers ?? undefined,
      });
      return { data: response.data as never };
    } catch (error) {
      throw toApiError(error);
    }
  },
};
