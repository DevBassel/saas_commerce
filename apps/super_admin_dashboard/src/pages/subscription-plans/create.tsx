"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCreate } from "@refinedev/core";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { LayersIcon } from "lucide-react";

import { SUBSCRIPTION_PLANS_RESOURCE } from "@/api/subscriptions.api";
import type { ApiError } from "@/api/client";
import {
  CreateView,
  CreateViewHeader,
} from "@/components/refine-ui/views/create-view";
import { PlanForm } from "@/components/subscription-plans/plan-form";
import {
  buildPlanPayload,
  emptyPlanFormValues,
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
import { cn } from "@/lib/utils";
import type {
  SubscriptionPlan,
  SubscriptionPlanPayload,
} from "@/types/subscription";

export const SubscriptionPlanCreate = () => {
  const navigate = useNavigate();

  const { mutate: createPlan, mutation } = useCreate<
    SubscriptionPlan,
    ApiError,
    SubscriptionPlanPayload
  >({
    resource: SUBSCRIPTION_PLANS_RESOURCE,
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

  const handleSubmit = (values: SubscriptionPlanFormValues) => {
    createPlan({
      values: buildPlanPayload(values),
      successNotification: {
        message: `Plan "${values.name}" created`,
        type: "success",
      },
    });
  };

  return (
    <CreateView>
      <CreateViewHeader />
      <Card className={cn("max-w-3xl")}>
        <CardHeader>
          <CardTitle className={cn("flex", "items-center", "gap-2")}>
            <LayersIcon className="h-5 w-5" />
            New Subscription Plan
          </CardTitle>
          <CardDescription>
            Define pricing, limits and included features
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <PlanForm
            form={form}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/subscription-plans")}
            isSubmitting={mutation.isPending}
            submitLabel="Create plan"
          />
        </CardContent>
      </Card>
    </CreateView>
  );
};

SubscriptionPlanCreate.displayName = "SubscriptionPlanCreate";
