"use client";

import { useTenantCurrency } from "@/lib/currency";
import { formatDiscount } from "@/lib/coupons";
import { cn } from "@/lib/utils";
import type { Coupon } from "@/types/coupon";

export const CouponDiscountCell = ({ coupon }: { coupon: Coupon }) => {
  const currency = useTenantCurrency();
  return (
    <span className={cn("font-medium")}>
      {formatDiscount(coupon.discountType, coupon.discountValue, currency)}
    </span>
  );
};

CouponDiscountCell.displayName = "CouponDiscountCell";

export const CouponUsageCell = ({ coupon }: { coupon: Coupon }) => (
  <span className={cn("text-muted-foreground")}>
    {coupon.usageCount}/{coupon.usageLimit ?? "∞"}
  </span>
);

CouponUsageCell.displayName = "CouponUsageCell";
