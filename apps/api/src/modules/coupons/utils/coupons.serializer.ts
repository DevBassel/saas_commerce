import { SerializedCoupon } from '../constants/coupons.interface';
import { Coupon } from '../entities/coupon.entity';

export const serializeCoupon = (coupon: Coupon): SerializedCoupon => ({
  id: coupon.id,
  code: coupon.code,
  description: coupon.description ?? null,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  minOrderAmount: coupon.minOrderAmount,
  maxDiscountAmount: coupon.maxDiscountAmount ?? null,
  usageLimit: coupon.usageLimit ?? null,
  perUserLimit: coupon.perUserLimit ?? null,
  usageCount: coupon.usageCount,
  remainingUses:
    coupon.usageLimit == null
      ? null
      : Math.max(coupon.usageLimit - coupon.usageCount, 0),
  startsAt: coupon.startsAt ?? null,
  expiresAt: coupon.expiresAt ?? null,
  isActive: coupon.isActive,
  createdAt: coupon.createdAt,
  updatedAt: coupon.updatedAt,
});
