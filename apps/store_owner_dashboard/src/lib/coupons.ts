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
  description: values.description ? values.description : null,
  minOrderAmount: values.minOrderAmount ?? null,
  maxDiscountAmount:
    values.discountType === "PERCENTAGE"
      ? (values.maxDiscountAmount ?? null)
      : null,
  usageLimit: values.usageLimit ?? null,
  perUserLimit: values.perUserLimit ?? null,
  startsAt: toIsoString(values.startsAt) ?? null,
  expiresAt: toIsoString(values.expiresAt) ?? null,
});

export const formatDiscount = (
  discountType: DiscountType,
  discountValue: number,
  currency: string,
): string =>
  discountType === "PERCENTAGE"
    ? `${discountValue}%`
    : formatMoney(discountValue, currency);
