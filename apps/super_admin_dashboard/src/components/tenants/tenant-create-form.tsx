"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { InputPassword } from "@/components/refine-ui/form/input-password";
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
import { Separator } from "@/components/ui/separator";
import {
  TENANT_PASSWORD_MAX,
  TENANT_PASSWORD_MIN,
} from "@/constants/tenants";
import { cn, slugify } from "@/lib/utils";
import type { CreateStoreFormValues } from "./tenant-schema";

export const TenantCreateForm = ({
  form,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  form: UseFormReturn<CreateStoreFormValues>;
  onSubmit: (values: CreateStoreFormValues) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}) => {
  const [slugTouched, setSlugTouched] = useState(false);

  const storeName = form.watch("storeName");

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("storeSlug", slugify(storeName));
    }
  }, [storeName, slugTouched, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("flex", "flex-col", "gap-6")}
      >
        <div className={cn("grid", "gap-6", "sm:grid-cols-2")}>
          <FormField
            control={form.control}
            name="storeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Store Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Store" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="storeSlug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Store Slug</FormLabel>
                <FormControl>
                  <Input
                    placeholder="acme-store"
                    {...field}
                    onChange={(e) => {
                      setSlugTouched(true);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Used for the tenant schema name
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="subdomain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subdomain (optional)</FormLabel>
              <FormControl>
                <Input placeholder="acme" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <div className={cn("grid", "gap-6", "sm:grid-cols-2")}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Owner Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
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
                <FormLabel>Owner Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="owner@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Owner Password</FormLabel>
              <FormControl>
                <InputPassword {...field} />
              </FormControl>
              <FormDescription>
                {TENANT_PASSWORD_MIN} to {TENANT_PASSWORD_MAX} characters
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className={cn("flex", "items-center", "justify-end", "gap-4")}>
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Store"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

TenantCreateForm.displayName = "TenantCreateForm";
