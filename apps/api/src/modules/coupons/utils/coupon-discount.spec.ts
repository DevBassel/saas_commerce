import { computeDiscount } from './coupon-discount';
import { DiscountType } from '../constants/discount-type.enum';

const coupon = (overrides: Record<string, unknown> = {}) => ({
  discountType: DiscountType.PERCENTAGE,
  discountValue: 10,
  maxDiscountAmount: null as number | null,
  ...overrides,
});

describe('computeDiscount', () => {
  it('computes a percentage discount', () => {
    expect(computeDiscount(coupon(), 100)).toEqual({ discountAmount: 10 });
  });

  it('rounds a percentage discount to cents', () => {
    expect(computeDiscount(coupon({ discountValue: 15 }), 19.99)).toEqual({
      discountAmount: 3,
    });
  });

  it('caps a percentage discount at maxDiscountAmount', () => {
    expect(
      computeDiscount(
        coupon({ discountValue: 50, maxDiscountAmount: 20 }),
        100,
      ),
    ).toEqual({ discountAmount: 20 });
  });

  it('does not cap a percentage discount below maxDiscountAmount', () => {
    expect(
      computeDiscount(
        coupon({ discountValue: 10, maxDiscountAmount: 20 }),
        100,
      ),
    ).toEqual({ discountAmount: 10 });
  });

  it('computes a fixed discount', () => {
    expect(
      computeDiscount(
        coupon({ discountType: DiscountType.FIXED_AMOUNT, discountValue: 15 }),
        100,
      ),
    ).toEqual({ discountAmount: 15 });
  });

  it('clamps a fixed discount to the subtotal', () => {
    expect(
      computeDiscount(
        coupon({ discountType: DiscountType.FIXED_AMOUNT, discountValue: 150 }),
        100,
      ),
    ).toEqual({ discountAmount: 100 });
  });

  it('never returns a negative amount', () => {
    expect(
      computeDiscount(
        coupon({ discountType: DiscountType.FIXED_AMOUNT, discountValue: 5 }),
        -10,
      ),
    ).toEqual({ discountAmount: 0 });
  });

  it('treats a non-finite subtotal as zero', () => {
    expect(computeDiscount(coupon(), Number.NaN)).toEqual({
      discountAmount: 0,
    });
  });
});
