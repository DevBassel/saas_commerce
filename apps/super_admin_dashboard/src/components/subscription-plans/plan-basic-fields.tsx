"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn, slugify } from "@/lib/utils";
import type { SubscriptionPlanFormValues } from "@/components/subscription-plans/plan-schema";

export const PlanBasicFields = ({
  form,
}: {
  form: UseFormReturn<SubscriptionPlanFormValues>;
}) => {
  const [slugTouched, setSlugTouched] = useState(false);
  const name = form.watch("name");

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("slug", slugify(name));
    }
  }, [name, slugTouched, form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          Name, pricing and availability for this plan
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("flex", "flex-col", "gap-6")}>
        <div className={cn("grid", "gap-6", "sm:grid-cols-2")}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Growth" {...field} />
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
                    placeholder="growth"
                    {...field}
                    onChange={(event) => {
                      setSlugTouched(true);
                      field.onChange(event);
                    }}
                  />
                </FormControl>
                <FormDescription>Unique plan identifier</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Who this plan is for"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className={cn("grid", "gap-6", "sm:grid-cols-3")}>
          <FormField
            control={form.control}
            name="monthlyPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly price</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="yearlyPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Yearly price</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input placeholder="usd" maxLength={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className={cn("grid", "gap-6", "sm:grid-cols-2")}>
          <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sort order</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="trialDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trial days</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className={cn("grid", "gap-6", "sm:grid-cols-2")}>
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem
                className={cn(
                  "flex",
                  "items-center",
                  "justify-between",
                  "rounded-md",
                  "border",
                  "p-4",
                )}
              >
                <div className={cn("flex", "flex-col", "gap-0.5")}>
                  <FormLabel>Active</FormLabel>
                  <FormDescription>
                    Inactive plans cannot be assigned
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isPublic"
            render={({ field }) => (
              <FormItem
                className={cn(
                  "flex",
                  "items-center",
                  "justify-between",
                  "rounded-md",
                  "border",
                  "p-4",
                )}
              >
                <div className={cn("flex", "flex-col", "gap-0.5")}>
                  <FormLabel>Public</FormLabel>
                  <FormDescription>
                    Visible to tenants when choosing a plan
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};

PlanBasicFields.displayName = "PlanBasicFields";
