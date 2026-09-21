"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { USER_PASSWORD_MAX, USER_PASSWORD_MIN } from "@/constants/users";
import type { UserCreateValues } from "./user-schema";

export const UserCreateForm = ({
  form,
  onSubmit,
  isSubmitting,
}: {
  form: UseFormReturn<UserCreateValues>;
  onSubmit: (values: UserCreateValues) => void;
  isSubmitting?: boolean;
}) => {
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("flex", "flex-col", "gap-6")}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="User name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="user@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {USER_PASSWORD_MIN}–{USER_PASSWORD_MAX} characters.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className={cn("flex", "justify-end")}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create user"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

UserCreateForm.displayName = "UserCreateForm";
