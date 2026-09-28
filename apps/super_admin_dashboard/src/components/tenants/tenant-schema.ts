"use client";

import { z } from "zod";

import {
  TENANT_PASSWORD_MAX,
  TENANT_PASSWORD_MIN,
  TENANT_SLUG_MESSAGE,
  TENANT_SLUG_PATTERN,
} from "@/constants/tenants";

export const createStoreSchema = z.object({
  name: z.string().min(1, "Owner name is required"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(
      TENANT_PASSWORD_MIN,
      `Password must be at least ${TENANT_PASSWORD_MIN} characters`,
    )
    .max(
      TENANT_PASSWORD_MAX,
      `Password must be at most ${TENANT_PASSWORD_MAX} characters`,
    ),
  storeName: z.string().min(2, "Store name must be at least 2 characters"),
  storeSlug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be at most 50 characters")
    .regex(TENANT_SLUG_PATTERN, TENANT_SLUG_MESSAGE),
  subdomain: z
    .string()
    .regex(TENANT_SLUG_PATTERN, TENANT_SLUG_MESSAGE)
    .optional()
    .or(z.literal("")),
});

export type CreateStoreFormValues = z.infer<typeof createStoreSchema>;
