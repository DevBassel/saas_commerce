"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOne, useUpdate } from "@refinedev/core";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { LayersIcon } from "lucide-react";

import { SUBSCRIPTION_PLANS_RESOURCE } from "@/api/subscriptions.api";
import type { ApiError } from "@/api/client";
import {
  EditView,
  EditViewHeader,
} from "@/components/refine-ui/views/edit-view";
import { PlanForm } from "@/components/subscription-plans/plan-form";
import {
  buildPlanPayload,
  emptyPlanFormValues,
  planToFormValues,
  subscriptionPlanSchema,
  type SubscriptionPlanFormValues,
} from "@/components/subscription-plans/plan-schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  SubscriptionPlan,
  SubscriptionPlanPayload,
} from "@/types/subscription";

export const SubscriptionPlanEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { query } = useOne<SubscriptionPlan>({
    resource: SUBSCRIPTION_PLANS_RESOURCE,
    id,
  });
  const plan = query.data?.data;

  const { mutate: updatePlan, mutation } = useUpdate<
    SubscriptionPlan,
    ApiError,
    SubscriptionPlanPayload
  >({
    resource: SUBSCRIPTION_PLANS_RESOURCE,
    id,
    mutationOptions: {
      onSuccess: () => {
        navigate("/subscription-plans");
      },
    },
  });

  const form = useForm<SubscriptionPlanFormValues>({
    resolver: zodResolver(subscriptionPlanSchema),
    defaultValues: emptyPlanFormValues(),
  });

  useEffect(() => {
    if (plan) {
      form.reset(planToFormValues(plan));
    }
  }, [plan, form]);

  const handleSubmit = (values: SubscriptionPlanFormValues) => {
    updatePlan({
      values: buildPlanPayload(values),
      successNotification: {
        message: `Plan "${values.name}" updated`,
        type: "success",
      },
    });
  };

  return (
    <EditView>
      <EditViewHeader />
      {query.isLoading ? (
        <Card className={cn("max-w-3xl")}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className={cn("flex", "flex-col", "gap-4")}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`plan-skeleton-${index}`} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : !plan ? (
        <p
          className={cn(
            "py-8",
            "text-center",
            "text-sm",
            "text-muted-foreground",
          )}
        >
          Plan not found.
        </p>
      ) : (
        <Card className={cn("max-w-3xl")}>
          <CardHeader>
            <CardTitle className={cn("flex", "items-center", "gap-2")}>
              <LayersIcon className="h-5 w-5" />
              Edit Subscription Plan
            </CardTitle>
            <CardDescription>
              Saving replaces the full limits and features sets
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent>
            <PlanForm
              form={form}
              onSubmit={handleSubmit}
              onCancel={() => navigate("/subscription-plans")}
              isSubmitting={mutation.isPending}
            />
          </CardContent>
        </Card>
      )}
    </EditView>
  );
};

SubscriptionPlanEdit.displayName = "SubscriptionPlanEdit";
