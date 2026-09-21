import { describe, expect, it } from "vitest";

import { productSchema } from "./product-schema";

const valid = {
  name: "Widget",
  sku: "SKU-123",
  description: "A widget",
  price: 19.99,
  stock: 5,
  isActive: true,
};

describe("productSchema", () => {
  it("accepts a valid product", () => {
    expect(productSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = productSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid SKU", () => {
    const result = productSchema.safeParse({ ...valid, sku: "-bad" });
    expect(result.success).toBe(false);
  });

  it("rejects a price with more than 2 decimals", () => {
    const result = productSchema.safeParse({ ...valid, price: 19.999 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = productSchema.safeParse({ ...valid, price: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer stock", () => {
    const result = productSchema.safeParse({ ...valid, stock: 1.5 });
    expect(result.success).toBe(false);
  });

  it("allows a missing/optional description", () => {
    const result = productSchema.safeParse({ ...valid, description: undefined });
    expect(result.success).toBe(true);
  });

  it("allows a null categoryId", () => {
    const result = productSchema.safeParse({ ...valid, categoryId: null });
    expect(result.success).toBe(true);
  });

  it("rejects a non-integer categoryId", () => {
    const result = productSchema.safeParse({ ...valid, categoryId: 1.5 });
    expect(result.success).toBe(false);
  });
});
