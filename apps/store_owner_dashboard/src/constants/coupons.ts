import type { DiscountType } from "@/types/coupon";

export const COUPON_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]*$/;
export const COUPON_CODE_MESSAGE =
  "must start with a letter or digit and use only A-Z, 0-9, _ or -";
export const MAX_COUPON_CODE_LENGTH = 64;

export const DISCOUNT_TYPES: DiscountType[] = ["PERCENTAGE", "FIXED_AMOUNT"];

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: "Percentage",
  FIXED_AMOUNT: "Fixed amount",
};
