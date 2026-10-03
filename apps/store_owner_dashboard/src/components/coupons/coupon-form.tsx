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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActiveField } from "@/components/refine-ui/form/active-field";
import {
  DISCOUNT_TYPE_LABELS,
  DISCOUNT_TYPES,
} from "@/constants/coupons";
import { toDateTimeLocalValue } from "@/lib/coupons";
import { cn } from "@/lib/utils";
import type { Coupon, DiscountType } from "@/types/coupon";
import type { CouponFormValues } from "./coupon-schema";

export const CouponForm = ({
  form,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: {
  form: UseFormReturnType<Coupon, HttpError, CouponFormValues>;
  onSubmit: (values: CouponFormValues) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}) => {
  const discountType = form.watch("discountType");

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("flex", "flex-col", "gap-6")}
      >
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="SAVE10"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(event.target.value.toUpperCase())
                  }
                />
              </FormControl>
              <FormDescription>
                Uppercase, starts with a letter or digit, then A-Z, 0-9, _ or -.
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
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "" ? undefined : event.target.value,
                    )
                  }
                />
              </FormControl>
              <FormDescription>
                Up to 2000 characters. Optional.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className={cn("grid", "gap-6", "md:grid-cols-2")}>
          <FormField
            control={form.control}
            name="discountType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount type</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as DiscountType)
                  }
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a discount type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DISCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {DISCOUNT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discountValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder={discountType === "PERCENTAGE" ? "10" : "0.00"}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber;
                      field.onChange(Number.isNaN(value) ? undefined : value);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Percentage between 0 and 100, or a fixed currency amount.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="minOrderAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum order amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber;
                      field.onChange(Number.isNaN(value) ? undefined : value);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Leave blank for no minimum.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {discountType === "PERCENTAGE" ? (
            <FormField
              control={form.control}
              name="maxDiscountAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum discount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const value = event.target.valueAsNumber;
                        field.onChange(Number.isNaN(value) ? undefined : value);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Caps the discount for percentage coupons. Optional.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="usageLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Usage limit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    placeholder="Unlimited"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber;
                      field.onChange(Number.isNaN(value) ? undefined : value);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Total redemptions allowed. Leave blank for unlimited.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="perUserLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Per-user limit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    placeholder="Unlimited"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber;
                      field.onChange(Number.isNaN(value) ? undefined : value);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Redemptions allowed per customer. Leave blank for unlimited.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starts at</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={toDateTimeLocalValue(field.value)}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? undefined
                          : event.target.value,
                      )
                    }
                  />
                </FormControl>
                <FormDescription>
                  Leave blank to make the coupon available immediately.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expires at</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={toDateTimeLocalValue(field.value)}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? undefined
                          : event.target.value,
                      )
                    }
                  />
                </FormControl>
                <FormDescription>
                  Leave blank for no expiry.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <ActiveField
          name="isActive"
          description="Inactive coupons cannot be applied at checkout."
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

CouponForm.displayName = "CouponForm";
