import { z } from "zod";

import { SKU_MESSAGE, SKU_REGEX } from "@/constants/products";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(255, "Name must be at most 255 characters"),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(64, "SKU must be at most 64 characters")
    .regex(SKU_REGEX, SKU_MESSAGE),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .nullish(),
  price: z
    .number({ invalid_type_error: "Price is required" })
    .min(0, "Price must be 0 or greater")
    .max(99999999.99, "Price is too large")
    .refine(
      (value) => Number(value.toFixed(2)) === value,
      "At most 2 decimal places allowed"
    ),
  stock: z
    .number({ invalid_type_error: "Stock is required" })
    .int("Stock must be a whole number")
    .min(0, "Stock must be 0 or greater"),
  isActive: z.boolean(),
  categoryId: z
    .number()
    .int("Category must be a whole number")
    .positive("Category is invalid")
    .nullish(),
});

export type ProductFormValues = z.infer<typeof productSchema>;
