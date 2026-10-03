"use client";

import { z } from "zod";

import {
  SLUG_MESSAGE,
  SLUG_PATTERN,
} from "@/constants/subscription-plans";
import {
  FEATURE_KEYS,
  LIMIT_KEYS,
  LIMIT_TYPE_BY_KEY,
} from "@/components/subscription-plans/plan-labels";
import type {
  SubscriptionFeatureKey,
  SubscriptionLimitKey,
  SubscriptionPlan,
  SubscriptionPlanPayload,
} from "@/types/subscription";

const moneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a non-negative amount (max 2 decimals)");

const intString = z.string().regex(/^\d+$/, "Enter a whole number");

const limitEntrySchema = z.object({
  unlimited: z.boolean(),
  value: z.string(),
});

const planBaseSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(80)
    .regex(SLUG_PATTERN, SLUG_MESSAGE),
  description: z.string().max(2000),
  monthlyPrice: moneyString,
  yearlyPrice: moneyString,
  currency: z.string().length(3, "Use a 3-letter currency code"),
  sortOrder: intString,
  trialDays: intString,
  active: z.boolean(),
  isPublic: z.boolean(),
  limits: z.object({
    STORAGE_BYTES: limitEntrySchema,
    DATABASE_BYTES: limitEntrySchema,
    STORE_ADMINS: limitEntrySchema,
    COUPONS_PER_MONTH: limitEntrySchema,
    PRODUCTS: limitEntrySchema,
  }),
  features: z.object({
    STRIPE_PAYMENTS: z.boolean(),
    STORE_CUSTOMIZATION: z.boolean(),
    COUPONS: z.boolean(),
    STAFF_MANAGEMENT: z.boolean(),
    PRODUCT_IMPORT_EXPORT: z.boolean(),
    CUSTOM_DOMAIN: z.boolean(),
    ADVANCED_ANALYTICS: z.boolean(),
    ADVANCED_REPORTS: z.boolean(),
    SEO_TOOLS: z.boolean(),
    AUDIT_LOGS: z.boolean(),
    PRIORITY_SUPPORT: z.boolean(),
  }),
});

export const subscriptionPlanSchema = planBaseSchema.superRefine(
  (values, ctx) => {
    LIMIT_KEYS.forEach((key) => {
      const entry = values.limits[key];
      if (entry.unlimited) return;
      if (!/^\d+$/.test(entry.value.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a whole number or mark unlimited",
          path: ["limits", key, "value"],
        });
      }
    });
  },
);

export type SubscriptionPlanFormValues = z.infer<
  typeof subscriptionPlanSchema
>;

const emptyLimits = (): SubscriptionPlanFormValues["limits"] => ({
  STORAGE_BYTES: { unlimited: false, value: "0" },
  DATABASE_BYTES: { unlimited: false, value: "0" },
  STORE_ADMINS: { unlimited: false, value: "0" },
  COUPONS_PER_MONTH: { unlimited: false, value: "0" },
  PRODUCTS: { unlimited: false, value: "0" },
});

const emptyFeatures = (): SubscriptionPlanFormValues["features"] => ({
  STRIPE_PAYMENTS: false,
  STORE_CUSTOMIZATION: false,
  COUPONS: false,
  STAFF_MANAGEMENT: false,
  PRODUCT_IMPORT_EXPORT: false,
  CUSTOM_DOMAIN: false,
  ADVANCED_ANALYTICS: false,
  ADVANCED_REPORTS: false,
  SEO_TOOLS: false,
  AUDIT_LOGS: false,
  PRIORITY_SUPPORT: false,
});

export const emptyPlanFormValues = (): SubscriptionPlanFormValues => ({
  name: "",
  slug: "",
  description: "",
  monthlyPrice: "0",
  yearlyPrice: "0",
  currency: "usd",
  sortOrder: "0",
  trialDays: "0",
  active: true,
  isPublic: true,
  limits: emptyLimits(),
  features: emptyFeatures(),
});

export const planToFormValues = (
  plan: SubscriptionPlan,
): SubscriptionPlanFormValues => {
  const limits = emptyLimits();
  LIMIT_KEYS.forEach((key) => {
    const row = plan.limits.find((limit) => limit.key === key);
    limits[key] =
      row && row.value != null
        ? { unlimited: false, value: String(row.value) }
        : { unlimited: true, value: "0" };
  });

  const features = emptyFeatures();
  FEATURE_KEYS.forEach((key) => {
    features[key] =
      plan.features.find((feature) => feature.key === key)?.enabled ?? false;
  });

  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? "",
    monthlyPrice: String(plan.monthlyPrice),
    yearlyPrice: String(plan.yearlyPrice),
    currency: plan.currency,
    sortOrder: String(plan.sortOrder),
    trialDays: String(plan.trialDays),
    active: plan.active,
    isPublic: plan.isPublic,
    limits,
    features,
  };
};

export const buildPlanPayload = (
  values: SubscriptionPlanFormValues,
): SubscriptionPlanPayload => ({
  name: values.name.trim(),
  slug: values.slug.trim(),
  description: values.description.trim() || null,
  monthlyPrice: Number(values.monthlyPrice),
  yearlyPrice: Number(values.yearlyPrice),
  currency: values.currency.trim().toLowerCase(),
  active: values.active,
  isPublic: values.isPublic,
  sortOrder: Number(values.sortOrder),
  trialDays: Number(values.trialDays),
  limits: LIMIT_KEYS.map((key: SubscriptionLimitKey) => ({
    key,
    value: values.limits[key].unlimited
      ? null
      : Number(values.limits[key].value),
    type: LIMIT_TYPE_BY_KEY[key],
  })),
  features: FEATURE_KEYS.map((key: SubscriptionFeatureKey) => ({
    key,
    enabled: values.features[key],
  })),
});
