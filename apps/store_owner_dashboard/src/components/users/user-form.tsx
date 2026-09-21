"use client";

import type { HttpError } from "@refinedev/core";
import type { UseFormReturnType } from "@refinedev/react-hook-form";

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
import type { User } from "@/types/user";
import type { UserFormValues } from "./user-schema";

export const UserForm = ({
  form,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
  email,
}: {
  form: UseFormReturnType<User, HttpError, UserFormValues>;
  onSubmit: (values: UserFormValues) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  email?: string;
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

        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input value={email ?? ""} disabled readOnly />
          </FormControl>
          <FormDescription>Email addresses cannot be changed.</FormDescription>
        </FormItem>

        <div className={cn("flex", "justify-end")}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};

UserForm.displayName = "UserForm";
