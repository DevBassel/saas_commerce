"use client";

import { useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn, slugify } from "@/lib/utils";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  LIMIT_KEYS,
  LIMIT_LABELS,
} from "@/components/subscription-plans/plan-labels";
import type { SubscriptionPlanFormValues } from "@/components/subscription-plans/plan-schema";

export const PlanForm = ({
  form,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = "Save plan",
}: {
  form: UseFormReturn<SubscriptionPlanFormValues>;
  onSubmit: (values: SubscriptionPlanFormValues) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}) => {
  const [slugTouched, setSlugTouched] = useState(false);
  const name = form.watch("name");

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("slug", slugify(name));
    }
  }, [name, slugTouched, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("flex", "flex-col", "gap-6")}
      >
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

        <Separator />

        <div className={cn("flex", "flex-col", "gap-1")}>
          <h3 className="text-lg font-semibold">Limits</h3>
          <p className={cn("text-sm", "text-muted-foreground")}>
            A limit with “Unlimited” on stores no value (unlimited).
          </p>
        </div>

        <div className={cn("flex", "flex-col", "gap-4")}>
          {LIMIT_KEYS.map((key) => (
            <FormField
              key={key}
              control={form.control}
              name={`limits.${key}.value`}
              render={({ field }) => {
                const unlimited = form.watch(`limits.${key}.unlimited`);
                return (
                  <FormItem
                    className={cn(
                      "grid",
                      "grid-cols-1",
                      "items-end",
                      "gap-4",
                      "rounded-md",
                      "border",
                      "p-4",
                      "sm:grid-cols-[1fr_10rem_auto]",
                    )}
                  >
                    <div className={cn("flex", "flex-col", "gap-0.5")}>
                      <FormLabel>{LIMIT_LABELS[key]}</FormLabel>
                      <FormDescription>
                        {key === "STORAGE_BYTES" || key === "DATABASE_BYTES"
                          ? "Value in bytes"
                          : "Value is a count"}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        disabled={unlimited}
                        {...field}
                      />
                    </FormControl>
                    <FormField
                      control={form.control}
                      name={`limits.${key}.unlimited`}
                      render={({ field: unlimitedField }) => (
                        <FormItem
                          className={cn(
                            "flex",
                            "items-center",
                            "gap-2",
                            "pb-2",
                          )}
                        >
                          <FormControl>
                            <Switch
                              checked={unlimitedField.value}
                              onCheckedChange={(checked) => {
                                unlimitedField.onChange(checked);
                                if (checked) {
                                  form.setValue(`limits.${key}.value`, "0");
                                }
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Unlimited
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormMessage className="sm:col-span-3" />
                  </FormItem>
                );
              }}
            />
          ))}
        </div>

        <Separator />

        <div className={cn("flex", "flex-col", "gap-1")}>
          <h3 className="text-lg font-semibold">Features</h3>
          <p className={cn("text-sm", "text-muted-foreground")}>
            Turn on the capabilities included in this plan.
          </p>
        </div>

        <div className={cn("grid", "gap-4", "sm:grid-cols-2")}>
          {FEATURE_KEYS.map((key) => (
            <FormField
              key={key}
              control={form.control}
              name={`features.${key}`}
              render={({ field }) => (
                <FormItem
                  className={cn(
                    "flex",
                    "items-center",
                    "justify-between",
                    "gap-4",
                    "rounded-md",
                    "border",
                    "p-4",
                  )}
                >
                  <FormLabel className="font-normal">
                    {FEATURE_LABELS[key]}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
        </div>

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
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};

PlanForm.displayName = "PlanForm";
