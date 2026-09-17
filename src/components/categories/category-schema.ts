import { z } from "zod";

import { SLUG_MESSAGE, SLUG_REGEX } from "@/constants/categories";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(255, "Name must be at most 255 characters"),
  slug: z
    .string()
    .trim()
    .max(255, "Slug must be at most 255 characters")
    .regex(SLUG_REGEX, SLUG_MESSAGE)
    .optional(),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .nullish(),
  isActive: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
