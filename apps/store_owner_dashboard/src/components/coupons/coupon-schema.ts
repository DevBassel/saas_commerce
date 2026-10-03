import { z } from "zod";

import {
  COUPON_CODE_MESSAGE,
  COUPON_CODE_REGEX,
  MAX_COUPON_CODE_LENGTH,
} from "@/constants/coupons";

const optionalMoney = (message: string) =>
  z
    .number({ invalid_type_error: message })
    .min(0, "Must be 0 or greater")
    .max(99999999.99, "Value is too large")
    .refine(
      (value) => Number(value.toFixed(2)) === value,
      "At most 2 decimal places allowed",
    )
    .nullish();

const optionalLimit = (message: string) =>
  z
    .number({ invalid_type_error: message })
    .int("Must be a whole number")
    .min(1, "Must be at least 1")
    .nullish();

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "Code is required")
      .max(
        MAX_COUPON_CODE_LENGTH,
        `Code must be at most ${MAX_COUPON_CODE_LENGTH} characters`,
      )
      .regex(COUPON_CODE_REGEX, COUPON_CODE_MESSAGE),
    description: z
      .string()
      .max(2000, "Description must be at most 2000 characters")
      .nullish(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    discountValue: z
      .number({ invalid_type_error: "Discount value is required" })
      .positive("Discount value must be greater than 0")
      .max(99999999.99, "Value is too large")
      .refine(
        (value) => Number(value.toFixed(2)) === value,
        "At most 2 decimal places allowed",
      ),
    minOrderAmount: optionalMoney("Minimum order amount must be a number"),
    maxDiscountAmount: optionalMoney("Maximum discount must be a number"),
    usageLimit: optionalLimit("Usage limit must be a number"),
    perUserLimit: optionalLimit("Per-user limit must be a number"),
    startsAt: z.string().nullish(),
    expiresAt: z.string().nullish(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.discountType === "PERCENTAGE" && values.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage cannot exceed 100",
      });
    }

    if (
      values.discountType === "FIXED_AMOUNT" &&
      values.maxDiscountAmount != null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxDiscountAmount"],
        message: "Only percentage coupons support a maximum discount",
      });
    }

    if (
      values.startsAt &&
      values.expiresAt &&
      new Date(values.startsAt).getTime() >=
        new Date(values.expiresAt).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Expiry must be after the start date",
      });
    }
  });

export type CouponFormValues = z.infer<typeof couponSchema>;
