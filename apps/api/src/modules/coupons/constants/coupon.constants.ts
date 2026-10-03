export const COUPON_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]*$/;
export const MAX_COUPON_CODE_LENGTH = 64;
export const COUPON_CODE_MESSAGE =
  'must be uppercase alphanumeric, may contain hyphens/underscores, must start alphanumeric';

/**
 * Coupon codes are stored and compared case-insensitively: input is trimmed and
 * uppercased before validation, lookup, create and update so that `save10` and
 * `SAVE10` resolve to the same coupon.
 */
export const normalizeCouponCode = (value: string): string =>
  value.trim().toUpperCase();

/**
 * `class-transformer` friendly variant: only string inputs are normalized so an
 * absent/`null` optional field stays absent instead of becoming the literal
 * `"UNDEFINED"`.
 */
export const normalizeCouponCodeValue = (value: unknown): unknown =>
  typeof value === 'string' ? normalizeCouponCode(value) : value;
