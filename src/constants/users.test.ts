import { describe, expect, it } from "vitest";

import {
  canCreateUsers,
  canManageTarget,
  filterAssignableRoles,
  permissionAction,
  permissionKeys,
  rankOf,
} from "./users";

describe("rankOf", () => {
  it("maps the seeded role keys to their ranks", () => {
    expect(rankOf("SUPER_ADMIN")).toBe(5);
    expect(rankOf("STORE_OWNER")).toBe(4);
    expect(rankOf("ADMIN")).toBe(3);
    expect(rankOf("CUSTOMER")).toBe(0);
  });

  it("treats custom or missing role keys as rank 0", () => {
    expect(rankOf("CUSTOM_ROLE")).toBe(0);
    expect(rankOf(null)).toBe(0);
    expect(rankOf(undefined)).toBe(0);
  });
});

describe("canManageTarget", () => {
  it("lets SUPER_ADMIN manage equal rank and below", () => {
    expect(canManageTarget("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(canManageTarget("SUPER_ADMIN", "STORE_OWNER")).toBe(true);
  });

  it("requires a strictly lower rank for non SUPER_ADMIN actors", () => {
    expect(canManageTarget("STORE_OWNER", "STORE_OWNER")).toBe(false);
    expect(canManageTarget("STORE_OWNER", "ADMIN")).toBe(true);
    expect(canManageTarget("ADMIN", "ADMIN")).toBe(false);
    expect(canManageTarget("ADMIN", "CUSTOMER")).toBe(true);
  });

  it("denies actors without a recognized role", () => {
    expect(canManageTarget(null, "CUSTOMER")).toBe(false);
    expect(canManageTarget("CUSTOMER", "CUSTOMER")).toBe(false);
  });
});

describe("filterAssignableRoles", () => {
  const roles = [
    { key: "SUPER_ADMIN" },
    { key: "STORE_OWNER" },
    { key: "ADMIN" },
    { key: "CUSTOMER" },
    { key: "MANAGER" },
  ];

  it("keeps every role for SUPER_ADMIN", () => {
    expect(filterAssignableRoles(roles, "SUPER_ADMIN")).toHaveLength(5);
  });

  it("keeps strictly lower ranks for STORE_OWNER", () => {
    expect(filterAssignableRoles(roles, "STORE_OWNER").map((r) => r.key)).toEqual(
      ["ADMIN", "CUSTOMER", "MANAGER"],
    );
  });

  it("keeps rank-0 roles only for ADMIN", () => {
    expect(filterAssignableRoles(roles, "ADMIN").map((r) => r.key)).toEqual([
      "CUSTOMER",
      "MANAGER",
    ]);
  });
});

describe("canCreateUsers", () => {
  it("allows administrators and above", () => {
    expect(canCreateUsers("SUPER_ADMIN")).toBe(true);
    expect(canCreateUsers("STORE_OWNER")).toBe(true);
    expect(canCreateUsers("ADMIN")).toBe(true);
  });

  it("denies customers and missing roles", () => {
    expect(canCreateUsers("CUSTOMER")).toBe(false);
    expect(canCreateUsers("CUSTOM_ROLE")).toBe(false);
    expect(canCreateUsers(null)).toBe(false);
    expect(canCreateUsers(undefined)).toBe(false);
  });
});

describe("permissionKeys", () => {
  it("normalizes a string array", () => {
    expect(permissionKeys(["users:read", "users:update"])).toEqual([
      "users:read",
      "users:update",
    ]);
  });

  it("normalizes permission objects", () => {
    expect(
      permissionKeys([{ id: 1, key: "users:read", name: "Read users" }]),
    ).toEqual(["users:read"]);
  });

  it("returns an empty array for null/undefined", () => {
    expect(permissionKeys(null)).toEqual([]);
    expect(permissionKeys(undefined)).toEqual([]);
  });
});

describe("permissionAction", () => {
  it("maps CRUD suffixes to their action", () => {
    expect(permissionAction("users:create")).toBe("create");
    expect(permissionAction("users:read")).toBe("read");
    expect(permissionAction("products:update")).toBe("update");
    expect(permissionAction("users:delete")).toBe("delete");
  });

  it("treats list and view as read", () => {
    expect(permissionAction("cart:list")).toBe("read");
    expect(permissionAction("cart:view")).toBe("read");
  });

  it("falls back to other for unknown or missing keys", () => {
    expect(permissionAction("weird")).toBe("other");
    expect(permissionAction("")).toBe("other");
    expect(permissionAction(null)).toBe("other");
    expect(permissionAction(undefined)).toBe("other");
  });
});
