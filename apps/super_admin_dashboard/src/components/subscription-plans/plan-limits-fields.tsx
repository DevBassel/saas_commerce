"use client";

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
import { cn } from "@/lib/utils";
import {
  LIMIT_KEYS,
  LIMIT_LABELS,
} from "@/components/subscription-plans/plan-labels";
import type { SubscriptionPlanFormValues } from "@/components/subscription-plans/plan-schema";

export const PlanLimitsFields = ({
  form,
}: {
  form: UseFormReturn<SubscriptionPlanFormValues>;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Limits</CardTitle>
        <CardDescription>
          A limit with “Unlimited” on stores no value (unlimited).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn("flex", "flex-col", "gap-4")}>
          {LIMIT_KEYS.map((key) => (
            <FormField
              key={key}
              control={form.control}
              name={`limits.${key}.value`}
              render={({ field }) => {
                const unlimited = form.watch(`limits.${key}.unlimited`);
                return (
                  <FormItem className={cn("rounded-md", "border", "p-4")}>
                    <div className={cn("flex", "flex-col", "gap-0.5")}>
                      <FormLabel>{LIMIT_LABELS[key]}</FormLabel>
                      <FormDescription>
                        {key === "STORAGE_BYTES" || key === "DATABASE_BYTES"
                          ? "Value in bytes"
                          : "Value is a count"}
                      </FormDescription>
                    </div>
                    <div
                      className={cn(
                        "flex",
                        "flex-row",
                        "items-center",
                        "gap-2",
                      )}
                    >
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
                    </div>
                    <FormMessage className="sm:col-span-3" />
                  </FormItem>
                );
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

PlanLimitsFields.displayName = "PlanLimitsFields";
