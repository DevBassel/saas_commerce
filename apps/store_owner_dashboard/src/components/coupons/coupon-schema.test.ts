import { describe, expect, it } from "vitest";

import { couponSchema } from "./coupon-schema";

const validPercentage = {
  code: "SAVE10",
  description: "Ten percent off",
  discountType: "PERCENTAGE" as const,
  discountValue: 10,
  minOrderAmount: 0,
  maxDiscountAmount: 50,
  usageLimit: 100,
  perUserLimit: 1,
  startsAt: undefined,
  expiresAt: undefined,
  isActive: true,
};

describe("couponSchema", () => {
  it("accepts a valid percentage coupon", () => {
    expect(couponSchema.safeParse(validPercentage).success).toBe(true);
  });

  it("accepts a valid fixed-amount coupon", () => {
    const result = couponSchema.safeParse({
      ...validPercentage,
      discountType: "FIXED_AMOUNT",
      discountValue: 5,
      maxDiscountAmount: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("normalizes a lowercase code to uppercase", () => {
    const result = couponSchema.safeParse({
      ...validPercentage,
      code: "save10",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe("SAVE10");
  });

  it("rejects a percentage discount above 100", () => {
    const result = couponSchema.safeParse({
      ...validPercentage,
      discountValue: 150,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a fixed-amount coupon with a maximum discount", () => {
    const result = couponSchema.safeParse({
      ...validPercentage,
      discountType: "FIXED_AMOUNT",
      maxDiscountAmount: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid code", () => {
    const result = couponSchema.safeParse({
      ...validPercentage,
      code: "BAD CODE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an expiry that is not after the start", () => {
    const result = couponSchema.safeParse({
      ...validPercentage,
      startsAt: "2026-02-01T10:00",
      expiresAt: "2026-02-01T09:00",
    });
    expect(result.success).toBe(false);
  });
});
