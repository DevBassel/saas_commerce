import { DiscountType } from './discount-type.enum';

export interface SerializedCoupon {
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
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Frozen coupon information attached to an order at checkout. Editing or
 * deleting the coupon afterwards never rewrites this snapshot.
 */
export interface CouponSnapshot {
  couponId: number;
  couponCode: string;
  couponDiscountType: DiscountType;
  couponDiscountValue: number;
}

export interface CouponApplication {
  couponId: number;
  discountAmount: number;
  snapshot: CouponSnapshot;
}

export interface SerializedCouponValidation {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  subtotal: number;
  discountAmount: number;
  total: number;
}
