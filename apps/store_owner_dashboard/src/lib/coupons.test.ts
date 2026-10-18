import { describe, expect, it } from "vitest";

import { buildCouponPayload } from "./coupons";
import type { CouponFormValues } from "@/components/coupons/coupon-schema";

const base: CouponFormValues = {
  code: "SAVE10",
  description: undefined,
  discountType: "PERCENTAGE",
  discountValue: 10,
  minOrderAmount: undefined,
  maxDiscountAmount: undefined,
  usageLimit: undefined,
  perUserLimit: undefined,
  startsAt: undefined,
  expiresAt: undefined,
  isActive: true,
};

describe("buildCouponPayload", () => {
  it("emits null for cleared optionals instead of dropping them", () => {
    const payload = buildCouponPayload(base);
    expect(payload.description).toBeNull();
    expect(payload.minOrderAmount).toBeNull();
    expect(payload.usageLimit).toBeNull();
    expect(payload.perUserLimit).toBeNull();
    expect(payload.startsAt).toBeNull();
    expect(payload.expiresAt).toBeNull();
  });

  it("keeps values that are set", () => {
    const payload = buildCouponPayload({
      ...base,
      description: "Hello",
      minOrderAmount: 25,
      usageLimit: 100,
      perUserLimit: 2,
      startsAt: "2030-01-01T00:00",
      expiresAt: "2030-12-31T00:00",
      maxDiscountAmount: 50,
    });
    expect(payload.description).toBe("Hello");
    expect(payload.minOrderAmount).toBe(25);
    expect(payload.usageLimit).toBe(100);
    expect(payload.perUserLimit).toBe(2);
    expect(payload.startsAt).toBe(new Date("2030-01-01T00:00").toISOString());
    expect(payload.maxDiscountAmount).toBe(50);
  });

  it("clears maxDiscountAmount for FIXED_AMOUNT coupons", () => {
    const payload = buildCouponPayload({
      ...base,
      discountType: "FIXED_AMOUNT",
      maxDiscountAmount: 50,
    });
    expect(payload.maxDiscountAmount).toBeNull();
  });
});
