import type { AxiosInstance } from "axios";
import { apiClient } from "./apiClient";

export type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

/**
 * Response of `POST /coupons/validate`: a preview of the discount against the
 * caller's current cart subtotal. It never consumes coupon usage.
 */
export interface ICouponValidation {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  subtotal: number;
  discountAmount: number;
  total: number;
}

export async function ValidateCoupon(
  code: string,
  client: AxiosInstance = apiClient,
): Promise<ICouponValidation> {
  const res = await client.post<ICouponValidation>("/coupons/validate", {
    code,
  });
  return res.data;
}
