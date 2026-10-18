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
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
} from "@/components/subscription-plans/plan-labels";
import type { SubscriptionPlanFormValues } from "@/components/subscription-plans/plan-schema";

export const PlanFeaturesFields = ({
  form,
}: {
  form: UseFormReturn<SubscriptionPlanFormValues>;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Features</CardTitle>
        <CardDescription>
          Turn on the capabilities included in this plan.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};

PlanFeaturesFields.displayName = "PlanFeaturesFields";
