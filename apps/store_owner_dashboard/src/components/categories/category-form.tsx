"use client";

import type { UseFormReturnType } from "@refinedev/react-hook-form";
import type { HttpError } from "@refinedev/core";

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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ActiveField } from "@/components/refine-ui/form/active-field";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/category";
import type { CategoryFormValues } from "./category-schema";

export const CategoryForm = ({
  form,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: {
  form: UseFormReturnType<Category, HttpError, CategoryFormValues>;
  onSubmit: (values: CategoryFormValues) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
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
                <Input placeholder="Category name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input
                  placeholder="category-slug"
                  value={field.value ?? ""}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    const value = event.target.value;
                    field.onChange(value === "" ? undefined : value);
                  }}
                />
              </FormControl>
              <FormDescription>
                Lowercase alphanumeric, hyphen-separated. Leave blank to
                auto-generate from the name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Optional description"
                  value={field.value ?? ""}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              </FormControl>
              <FormDescription>
                Up to 2000 characters. Optional.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <ActiveField
          name="isActive"
          description="Inactive categories are hidden from the storefront."
        />

        <div className={cn("flex", "justify-end")}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};

CategoryForm.displayName = "CategoryForm";
