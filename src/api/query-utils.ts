import type { CrudFilter, CrudSort, Pagination } from "@refinedev/core";

export const resolveDetailPath = (
  resource: string,
  id: unknown,
  meta?: Record<string, unknown>,
): string =>
  typeof meta?.detailPath === "string"
    ? `${meta.detailPath}/${id}`
    : `${resource}/${id}`;

export const buildListParams = ({
  pagination,
  sorters,
}: {
  pagination?: Pagination;
  sorters?: CrudSort[];
}): Record<string, string | number> => {
  const params: Record<string, string | number> = {};

  if (pagination && pagination.mode !== "off") {
    const { currentPage = 1, pageSize = 10 } = pagination;
    params.page = currentPage;
    params.limit = pageSize;
  }

  const sorter = sorters?.[0];
  if (sorter) {
    params.sortBy = sorter.field;
    params.sortOrder = sorter.order;
  }

  return params;
};

export const applyFilters = <T extends Record<string, unknown>>(
  data: T[],
  filters?: CrudFilter[]
): T[] => {
  if (!filters?.length) return data;
  const logicalFilters = filters.filter((f) => "field" in f);

  return data.filter((item) =>
    logicalFilters.every((filter) => {
      if (!("field" in filter)) return true;
      const { field, operator, value } = filter;
      const itemValue = item[field];

      switch (operator) {
        case "eq":
          return itemValue === value;
        case "ne":
          return itemValue !== value;
        case "contains":
          return String(itemValue ?? "")
            .toLowerCase()
            .includes(String(value ?? "").toLowerCase());
        case "in":
          return Array.isArray(value) && value.includes(itemValue);
        case "nin":
          return Array.isArray(value) && !value.includes(itemValue);
        case "lt":
          return (itemValue as number) < (value as number);
        case "lte":
          return (itemValue as number) <= (value as number);
        case "gt":
          return (itemValue as number) > (value as number);
        case "gte":
          return (itemValue as number) >= (value as number);
        case "startswith":
          return String(itemValue ?? "")
            .toLowerCase()
            .startsWith(String(value ?? "").toLowerCase());
        case "endswith":
          return String(itemValue ?? "")
            .toLowerCase()
            .endsWith(String(value ?? "").toLowerCase());
        case "null":
          return itemValue == null;
        case "nnull":
          return itemValue != null;
        default:
          throw new Error(
            `Unsupported filter operator: "${operator}" for field "${field}"`,
          );
      }
    })
  );
};

export const applySorters = <T extends Record<string, unknown>>(
  data: T[],
  sorters?: CrudSort[]
): T[] => {
  if (!sorters?.length) return data;
  return [...data].sort((a, b) => {
    for (const sorter of sorters) {
      const { field, order } = sorter;
      const aVal = a[field as keyof T];
      const bVal = b[field as keyof T];
      let cmp = 0;
      if (aVal == null && bVal == null) cmp = 0;
      else if (aVal == null) cmp = -1;
      else if (bVal == null) cmp = 1;
      else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      if (cmp !== 0) {
        return order === "asc" ? cmp : -cmp;
      }
    }
    return 0;
  });
};

export const applyPagination = <T>(
  data: T[],
  pagination?: Pagination
): { data: T[]; total: number } => {
  const total = data.length;
  if (!pagination || pagination.mode === "off") {
    return { data, total };
  }
  const { currentPage = 1, pageSize = 10 } = pagination;
  const start = (currentPage - 1) * pageSize;
  return {
    data: data.slice(start, start + pageSize),
    total,
  };
};
