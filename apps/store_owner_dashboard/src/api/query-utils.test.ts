import { describe, expect, it } from "vitest";

import {
  applyFilters,
  applyPagination,
  applySorters,
  buildListParams,
  resolveDetailPath,
} from "./query-utils";

type Row = { id: number; name: string; price: number };

const rows: Row[] = [
  { id: 1, name: "Bravo", price: 20 },
  { id: 2, name: "Alpha", price: 30 },
  { id: 3, name: "Charlie", price: 10 },
];

describe("applyFilters", () => {
  it("returns the original data when no filters are provided", () => {
    expect(applyFilters(rows, undefined)).toBe(rows);
    expect(applyFilters(rows, [])).toBe(rows);
  });

  it("filters with eq", () => {
    const result = applyFilters(rows, [{ field: "name", operator: "eq", value: "Alpha" }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("filters case-insensitively with contains", () => {
    const result = applyFilters(rows, [
      { field: "name", operator: "contains", value: "a" },
    ]);
    expect(result.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it("throws instead of silently passing for unsupported operators", () => {
    expect(() =>
      applyFilters(rows, [
        { field: "name", operator: "between" as never, value: "a" },
      ]),
    ).toThrow(/Unsupported filter operator/);
  });

  it("filters nested fields with eq", () => {
    const nested = [
      { id: 1, role: { key: "ADMIN" } },
      { id: 2, role: { key: "CUSTOMER" } },
    ];
    const result = applyFilters(nested, [
      { field: "role.key", operator: "eq", value: "ADMIN" },
    ]);
    expect(result.map((row) => row.id)).toEqual([1]);
  });

  it("filters nested fields with in", () => {
    const nested = [
      { id: 1, role: { key: "ADMIN" } },
      { id: 2, role: { key: "CUSTOMER" } },
      { id: 3, role: { key: "STORE_OWNER" } },
    ];
    const result = applyFilters(nested, [
      { field: "role.key", operator: "in", value: ["ADMIN", "CUSTOMER"] },
    ]);
    expect(result.map((row) => row.id)).toEqual([1, 2]);
  });

  it("excludes rows with a missing nested path instead of crashing", () => {
    const nested = [
      { id: 1, role: { key: "ADMIN" } },
      { id: 2, role: null },
    ];
    const result = applyFilters(nested, [
      { field: "role.key", operator: "in", value: ["ADMIN"] },
    ]);
    expect(result.map((row) => row.id)).toEqual([1]);
  });
});

describe("applySorters", () => {
  it("sorts numerically ascending", () => {
    const result = applySorters(rows, [{ field: "price", order: "asc" }]);
    expect(result.map((row) => row.id)).toEqual([3, 1, 2]);
  });

  it("sorts descending without mutating the input", () => {
    const result = applySorters(rows, [{ field: "price", order: "desc" }]);
    expect(result.map((row) => row.id)).toEqual([2, 1, 3]);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);
  });
});

describe("applyPagination", () => {
  it("returns all rows when pagination is off", () => {
    const result = applyPagination(rows, { mode: "off" });
    expect(result.data).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it("slices the requested page", () => {
    const result = applyPagination(rows, {
      mode: "server",
      currentPage: 2,
      pageSize: 2,
    });
    expect(result.data.map((row) => row.id)).toEqual([3]);
    expect(result.total).toBe(3);
  });
});

describe("resolveDetailPath", () => {
  it("defaults to the resource path when no detailPath meta is provided", () => {
    expect(resolveDetailPath("products", 7)).toBe("products/7");
    expect(resolveDetailPath("products", 7, {})).toBe("products/7");
  });

  it("uses the detailPath meta override when present", () => {
    expect(
      resolveDetailPath("users", 7, { detailPath: "users/profile" }),
    ).toBe("users/profile/7");
  });

  it("ignores a non-string detailPath meta value", () => {
    expect(resolveDetailPath("users", 7, { detailPath: 42 })).toBe("users/7");
  });
});

describe("buildListParams", () => {
  it("maps pagination and the first sorter to server params", () => {
    expect(
      buildListParams({
        pagination: { mode: "server", currentPage: 3, pageSize: 25 },
        sorters: [{ field: "createdAt", order: "desc" }],
      }),
    ).toEqual({
      page: 3,
      limit: 25,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("omits params when pagination is off and there are no sorters", () => {
    expect(
      buildListParams({ pagination: { mode: "off" }, sorters: [] }),
    ).toEqual({});
  });

  it("omits every param when omit is set", () => {
    expect(
      buildListParams({
        pagination: { mode: "server", currentPage: 3, pageSize: 25 },
        sorters: [{ field: "createdAt", order: "desc" }],
        omit: true,
      }),
    ).toEqual({});
  });
});
