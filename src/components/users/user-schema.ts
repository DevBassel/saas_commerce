import { z } from "zod";

import {
  USER_NAME_MAX,
  USER_NAME_MIN,
  USER_PASSWORD_MAX,
  USER_PASSWORD_MIN,
} from "@/constants/users";

export const userSchema = z.object({
  name: z
    .string()
    .trim()
    .min(USER_NAME_MIN, `Name must be at least ${USER_NAME_MIN} characters`)
    .max(USER_NAME_MAX, `Name must be at most ${USER_NAME_MAX} characters`),
});

export type UserFormValues = z.infer<typeof userSchema>;

export const userCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(USER_NAME_MIN, `Name must be at least ${USER_NAME_MIN} characters`)
    .max(USER_NAME_MAX, `Name must be at most ${USER_NAME_MAX} characters`),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(255, "Email must be at most 255 characters"),
  password: z
    .string()
    .min(
      USER_PASSWORD_MIN,
      `Password must be at least ${USER_PASSWORD_MIN} characters`,
    )
    .max(
      USER_PASSWORD_MAX,
      `Password must be at most ${USER_PASSWORD_MAX} characters`,
    ),
});

export type UserCreateValues = z.infer<typeof userCreateSchema>;
