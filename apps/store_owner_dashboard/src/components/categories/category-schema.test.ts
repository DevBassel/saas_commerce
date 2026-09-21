import { describe, expect, it } from "vitest";

import { categorySchema } from "./category-schema";

const valid = {
  name: "Electronics",
  slug: "electronics",
  description: "Devices and gadgets",
  isActive: true,
};

describe("categorySchema", () => {
  it("accepts a valid category", () => {
    expect(categorySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = categorySchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
  });

  it("allows an omitted slug (auto-generated server-side)", () => {
    const result = categorySchema.safeParse({ ...valid, slug: undefined });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid slug", () => {
    const result = categorySchema.safeParse({ ...valid, slug: "Bad Slug" });
    expect(result.success).toBe(false);
  });

  it("allows a missing/optional description", () => {
    const result = categorySchema.safeParse({
      ...valid,
      description: undefined,
    });
    expect(result.success).toBe(true);
  });
});
