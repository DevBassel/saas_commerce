import { round2 } from '../../../common/utils/money';
import { DiscountType } from '../constants/discount-type.enum';
import { Coupon } from '../entities/coupon.entity';

export interface ComputedDiscount {
  discountAmount: number;
}

/**
 * Pure discount calculation for a coupon applied to an order subtotal.
 *
 * - PERCENTAGE: `subtotal * value / 100`, capped by `maxDiscountAmount` when set.
 * - FIXED_AMOUNT: the fixed value, clamped to the subtotal.
 *
 * The result is always rounded to cents and clamped to `[0, subtotal]`, so an
 * order total can never go negative.
 */
export const computeDiscount = (
  coupon: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscountAmount'>,
  subtotal: number,
): ComputedDiscount => {
  const base = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0;

  let raw: number;
  if (coupon.discountType === DiscountType.PERCENTAGE) {
    raw = round2((base * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount != null) {
      raw = Math.min(raw, coupon.maxDiscountAmount);
    }
  } else {
    raw = coupon.discountValue;
  }

  const clamped = Math.min(Math.max(round2(raw), 0), base);
  return { discountAmount: clamped };
};
