"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { PlanBasicFields } from "@/components/subscription-plans/plan-basic-fields";
import { PlanFeaturesFields } from "@/components/subscription-plans/plan-features-fields";
import { PlanLimitsFields } from "@/components/subscription-plans/plan-limits-fields";
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
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("flex", "flex-col", "gap-6")}
      >
        <PlanBasicFields form={form} />

        <div className={"grid grid-cols-1 lg:grid-cols-2 gap-1"}>
          <PlanLimitsFields form={form} />

          <PlanFeaturesFields form={form} />
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
