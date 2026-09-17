import type { DataProvider } from "@refinedev/core";

import { apiClient, toApiError } from "@/api/client";
import { API_URL } from "@/api/constants";
import {
  applyFilters,
  applySorters,
  applyPagination,
  buildListParams,
} from "@/api/query-utils";

type ListResponse = {
  data?: unknown;
  total?: unknown;
};

const toRecordArray = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const data = (payload as ListResponse | null)?.data;
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
};

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters }) => {
    try {
      const response = await apiClient.get(resource, {
        params: buildListParams({ pagination, sorters }),
      });
      const body = response.data;

      // Server-driven pagination: backend returns `{ data, total }`.
      if (body && !Array.isArray(body) && typeof body === "object") {
        const data = toRecordArray(body);
        const total =
          typeof (body as ListResponse).total === "number"
            ? (body as ListResponse).total
            : data.length;
        return { data: data as never[], total: total as number };
      }

      // Fallback for backends that ignore query params and return a plain array.
      const list = toRecordArray(body);
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
      const response = await apiClient.get<Record<string, unknown>>(
        `${resource}/${id}`,
      );
      return { data: response.data as never };
    } catch (error) {
      throw toApiError(error);
    }
  },

  getMany: async ({ resource, ids }) => {
    try {
      const response = await apiClient.get(resource, {
        params: { ids: ids.join(",") },
      });
      const list = toRecordArray(response.data);
      return {
        data: list.filter((item) => ids.includes(item.id as never)) as never[],
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  create: async ({ resource, variables }) => {
    try {
      const response = await apiClient.post<Record<string, unknown>>(
        resource,
        variables,
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
        variables,
      );
      return { data: response.data as never };
    } catch (error) {
      throw toApiError(error);
    }
  },

  deleteOne: async ({ resource, id }) => {
    try {
      const response = await apiClient.delete<Record<string, unknown>>(
        `${resource}/${id}`,
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
