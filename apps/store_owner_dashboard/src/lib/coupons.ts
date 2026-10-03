import type { CouponFormValues } from "@/components/coupons/coupon-schema";
import { formatMoney } from "@/lib/currency";
import type { DiscountType } from "@/types/coupon";

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateTimeLocalValue = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toIsoString = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const buildCouponPayload = (values: CouponFormValues) => ({
  ...values,
  description: values.description ? values.description : undefined,
  startsAt: toIsoString(values.startsAt),
  expiresAt: toIsoString(values.expiresAt),
  maxDiscountAmount:
    values.discountType === "PERCENTAGE" ? values.maxDiscountAmount : undefined,
});

export const formatDiscount = (
  discountType: DiscountType,
  discountValue: number,
  currency: string,
): string =>
  discountType === "PERCENTAGE"
    ? `${discountValue}%`
    : formatMoney(discountValue, currency);
