import { describe, expect, it } from "vitest";

import {
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  OWNER_CANCELLABLE_STATUSES,
  TERMINAL_ORDER_STATUSES,
  canCancelOrder,
  canManageOrders,
  isTerminalStatus,
  nextStatuses,
} from "./orders";
import type { OrderStatus } from "@/types/order";

const ALL_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURNED",
  "CANCELLED",
];

describe("ORDER_TRANSITIONS", () => {
  it("mirrors the backend forward map", () => {
    expect(ORDER_TRANSITIONS).toEqual({
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PROCESSING", "CANCELLED"],
      PROCESSING: ["SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED", "CANCELLED"],
      DELIVERED: ["RETURN_REQUESTED"],
      RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
      RETURNED: [],
      CANCELLED: [],
    });
  });

  it("labels every status", () => {
    for (const status of ALL_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("nextStatuses", () => {
  it("returns the allowed targets per status", () => {
    expect(nextStatuses("PENDING")).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(nextStatuses("SHIPPED")).toEqual(["DELIVERED", "CANCELLED"]);
    expect(nextStatuses("RETURN_REQUESTED")).toEqual(["RETURNED", "DELIVERED"]);
  });

  it("returns nothing for terminal statuses", () => {
    expect(nextStatuses("RETURNED")).toEqual([]);
    expect(nextStatuses("CANCELLED")).toEqual([]);
  });
});

describe("terminal and owner-cancellable sets", () => {
  it("treats DELIVERED, RETURNED and CANCELLED as terminal", () => {
    expect(TERMINAL_ORDER_STATUSES).toEqual([
      "DELIVERED",
      "RETURNED",
      "CANCELLED",
    ]);
    expect(isTerminalStatus("DELIVERED")).toBe(true);
    expect(isTerminalStatus("RETURNED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
    expect(isTerminalStatus("PENDING")).toBe(false);
    expect(isTerminalStatus("SHIPPED")).toBe(false);
    expect(isTerminalStatus("RETURN_REQUESTED")).toBe(false);
  });

  it("only lets owners cancel PENDING and CONFIRMED", () => {
    expect(OWNER_CANCELLABLE_STATUSES).toEqual(["PENDING", "CONFIRMED"]);
  });
});

describe("canManageOrders", () => {
  it("allows administrators and above", () => {
    expect(canManageOrders("SUPER_ADMIN")).toBe(true);
    expect(canManageOrders("STORE_OWNER")).toBe(true);
    expect(canManageOrders("ADMIN")).toBe(true);
  });

  it("denies customers and missing roles", () => {
    expect(canManageOrders("CUSTOMER")).toBe(false);
    expect(canManageOrders("CUSTOM_ROLE")).toBe(false);
    expect(canManageOrders(null)).toBe(false);
    expect(canManageOrders(undefined)).toBe(false);
  });
});

describe("canCancelOrder", () => {
  it("lets managers cancel any pre-delivery order", () => {
    expect(canCancelOrder("PENDING", "ADMIN")).toBe(true);
    expect(canCancelOrder("PROCESSING", "STORE_OWNER")).toBe(true);
    expect(canCancelOrder("SHIPPED", "SUPER_ADMIN")).toBe(true);
    expect(canCancelOrder("DELIVERED", "ADMIN")).toBe(false);
    expect(canCancelOrder("RETURN_REQUESTED", "ADMIN")).toBe(false);
    expect(canCancelOrder("RETURNED", "ADMIN")).toBe(false);
    expect(canCancelOrder("CANCELLED", "ADMIN")).toBe(false);
  });

  it("limits owners to PENDING and CONFIRMED", () => {
    expect(canCancelOrder("PENDING", "CUSTOMER")).toBe(true);
    expect(canCancelOrder("CONFIRMED", "CUSTOMER")).toBe(true);
    expect(canCancelOrder("PROCESSING", "CUSTOMER")).toBe(false);
    expect(canCancelOrder("SHIPPED", "CUSTOMER")).toBe(false);
    expect(canCancelOrder("DELIVERED", "CUSTOMER")).toBe(false);
    expect(canCancelOrder("RETURN_REQUESTED", "CUSTOMER")).toBe(false);
    expect(canCancelOrder("RETURNED", "CUSTOMER")).toBe(false);
    expect(canCancelOrder("CANCELLED", "CUSTOMER")).toBe(false);
  });

  it("denies cancellation without a recognized role", () => {
    expect(canCancelOrder("PENDING", null)).toBe(true);
    expect(canCancelOrder("PROCESSING", null)).toBe(false);
  });
});
