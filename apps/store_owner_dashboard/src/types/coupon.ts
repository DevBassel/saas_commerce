export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface Coupon {
  id: number;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usageCount: number;
  remainingUses: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
