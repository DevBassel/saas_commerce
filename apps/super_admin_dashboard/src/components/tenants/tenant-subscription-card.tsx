"use client";

import { useState } from "react";
import { useCustom, useList, useNotification } from "@refinedev/core";
import { format } from "date-fns";
import { Loader2Icon } from "lucide-react";

import { toApiError } from "@/api/client";
import {
  SUBSCRIPTION_PLANS_RESOURCE,
  subscriptionsApi,
} from "@/api/subscriptions.api";
import {
  BILLING_INTERVAL_LABELS,
  LIMIT_KEYS,
  LIMIT_LABELS,
  LIMIT_TYPE_BY_KEY,
  formatLimitValue,
} from "@/components/subscription-plans/plan-labels";
import { SubscriptionStatusBadge } from "@/components/subscription-plans/subscription-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBytes, formatCurrency, storagePercent } from "@/lib/utils";
import type {
  BillingInterval,
  SubscriptionPlan,
  TenantSubscriptionResponse,
  UsageSummary,
  UsageValue,
} from "@/types/subscription";

const formatDate = (value?: string | null) =>
  value ? format(new Date(value), "MMM d, yyyy") : "—";

const formatUsed = (value: number, type: "BYTES" | "COUNT") =>
  type === "BYTES" ? formatBytes(value) : value.toLocaleString();

const UsageRow = ({
  label,
  value,
  type,
}: {
  label: string;
  value?: UsageValue;
  type: "BYTES" | "COUNT";
}) => {
  if (!value) return null;
  const percent =
    value.limit == null || value.limit <= 0
      ? null
      : storagePercent(value.used, value.limit);

  return (
    <div
      className={cn(
        "flex",
        "flex-col",
        "gap-1.5",
        "rounded-md",
        "border",
        "p-3",
      )}
    >
      <div className={cn("flex", "items-center", "justify-between", "gap-2")}>
        <span className={cn("text-sm", "font-medium")}>{label}</span>
        <span className={cn("text-sm", "text-muted-foreground")}>
          {formatUsed(value.used, type)} /{" "}
          {formatLimitValue(value.limit, type)}
        </span>
      </div>
      {percent == null ? (
        <span className={cn("text-xs", "text-muted-foreground")}>
          Unlimited
        </span>
      ) : (
        <Progress value={percent} />
      )}
    </div>
  );
};

export const TenantSubscriptionCard = ({ tenantId }: { tenantId: number }) => {
  const { open } = useNotification();
  const [busy, setBusy] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("MONTHLY");

  const subscriptionQuery = useCustom<TenantSubscriptionResponse>({
    url: `platform/tenants/${tenantId}/subscription`,
    method: "get",
    queryOptions: { enabled: Boolean(tenantId) },
  });
  const usageQuery = useCustom<UsageSummary>({
    url: `platform/tenants/${tenantId}/subscription/usage`,
    method: "get",
    queryOptions: { enabled: Boolean(tenantId) },
  });

  const plansQuery = useList<SubscriptionPlan>({
    resource: SUBSCRIPTION_PLANS_RESOURCE,
    filters: [
      { field: "active", operator: "eq", value: true },
      { field: "isPublic", operator: "eq", value: true },
    ],
    pagination: { mode: "off" },
    queryOptions: { enabled: changeOpen },
  });

  const data = subscriptionQuery.query.data?.data;
  const plan = data?.plan ?? null;
  const subscription = data?.subscription ?? null;
  const usage = usageQuery.query.data?.data;
  const plans = plansQuery.result.data ?? [];

  const isLoading = subscriptionQuery.query.isLoading;
  const error = subscriptionQuery.query.error
    ? toApiError(subscriptionQuery.query.error).message
    : null;

  const refetchAll = async () => {
    await Promise.all([
      subscriptionQuery.query.refetch(),
      usageQuery.query.refetch(),
    ]);
  };

  const handleOpenChange = () => {
    setSelectedPlanId(plan ? String(plan.id) : "");
    setBillingInterval(subscription?.billingInterval ?? "MONTHLY");
    setChangeOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedPlanId) {
      open?.({ type: "error", message: "Select a plan first" });
      return;
    }
    setBusy(true);
    try {
      await subscriptionsApi.assignTenantPlan(tenantId, {
        planId: Number(selectedPlanId),
        billingInterval,
      });
      open?.({ type: "success", message: "Subscription updated" });
      setChangeOpen(false);
      await refetchAll();
    } catch (assignError) {
      open?.({ type: "error", message: toApiError(assignError).message });
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (status: "ACTIVE" | "CANCELED") => {
    setBusy(true);
    try {
      await subscriptionsApi.setTenantStatus(tenantId, status);
      open?.({
        type: "success",
        message:
          status === "CANCELED"
            ? "Subscription canceled"
            : "Subscription reactivated",
      });
      await refetchAll();
    } catch (statusError) {
      open?.({ type: "error", message: toApiError(statusError).message });
    } finally {
      setBusy(false);
    }
  };

  const price =
    plan == null
      ? null
      : subscription?.billingInterval === "YEARLY"
        ? plan.yearlyPrice
        : plan.monthlyPrice;

  return (
    <Card>
      <CardHeader>
        <div className={cn("flex", "items-start", "justify-between", "gap-4")}>
          <div className={cn("flex", "flex-col", "gap-1.5")}>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Current plan, billing period and live usage
            </CardDescription>
          </div>
          <div className={cn("flex", "items-center", "gap-2")}>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={handleOpenChange}
            >
              Change plan
            </Button>
            {subscription ? (
              subscription.status === "CANCELED" ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleStatus("ACTIVE")}
                >
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleStatus("CANCELED")}
                >
                  Cancel subscription
                </Button>
              )
            ) : null}
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent>
        {isLoading ? (
          <div className={cn("flex", "flex-col", "gap-4")}>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <p className={cn("text-sm", "text-muted-foreground")}>{error}</p>
        ) : (
          <div className={cn("flex", "flex-col", "gap-6")}>
            <div
              className={cn(
                "grid",
                "gap-4",
                "sm:grid-cols-2",
                "lg:grid-cols-4",
              )}
            >
              <div className={cn("flex", "flex-col", "gap-1")}>
                <span className={cn("text-xs", "text-muted-foreground")}>
                  Plan
                </span>
                <span className={cn("font-medium")}>{plan?.name ?? "—"}</span>
              </div>
              <div className={cn("flex", "flex-col", "gap-1")}>
                <span className={cn("text-xs", "text-muted-foreground")}>
                  Status
                </span>
                {subscription ? (
                  <SubscriptionStatusBadge status={subscription.status} />
                ) : (
                  <span className={cn("text-muted-foreground")}>—</span>
                )}
              </div>
              <div className={cn("flex", "flex-col", "gap-1")}>
                <span className={cn("text-xs", "text-muted-foreground")}>
                  Billing interval
                </span>
                <span>
                  {subscription
                    ? BILLING_INTERVAL_LABELS[subscription.billingInterval]
                    : "—"}
                </span>
              </div>
              <div className={cn("flex", "flex-col", "gap-1")}>
                <span className={cn("text-xs", "text-muted-foreground")}>
                  Price
                </span>
                <span>
                  {plan && price != null
                    ? formatCurrency(price, plan.currency)
                    : "—"}
                </span>
              </div>
              <div className={cn("flex", "flex-col", "gap-1")}>
                <span className={cn("text-xs", "text-muted-foreground")}>
                  Current period
                </span>
                <span>
                  {formatDate(subscription?.currentPeriodStart)} –{" "}
                  {formatDate(subscription?.currentPeriodEnd)}
                </span>
              </div>
              {subscription?.trialEnd ? (
                <div className={cn("flex", "flex-col", "gap-1")}>
                  <span className={cn("text-xs", "text-muted-foreground")}>
                    Trial
                  </span>
                  <span>
                    {formatDate(subscription.trialStart)} –{" "}
                    {formatDate(subscription.trialEnd)}
                  </span>
                </div>
              ) : null}
            </div>

            <Separator />

            <div className={cn("flex", "flex-col", "gap-1")}>
              <span className={cn("text-sm", "font-medium")}>Usage</span>
              <span className={cn("text-xs", "text-muted-foreground")}>
                Live values from the tenant schema
              </span>
            </div>

            <div
              className={cn("grid", "gap-3", "sm:grid-cols-2", "lg:grid-cols-4")}
            >
              {LIMIT_KEYS.map((key) => (
                <UsageRow
                  key={key}
                  label={LIMIT_LABELS[key]}
                  value={usage?.[key]}
                  type={LIMIT_TYPE_BY_KEY[key]}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change subscription plan</DialogTitle>
            <DialogDescription>
              Assign a plan and billing interval. Only active public plans can
              be assigned.
            </DialogDescription>
          </DialogHeader>

          <div className={cn("flex", "flex-col", "gap-4")}>
            <div className={cn("flex", "flex-col", "gap-2")}>
              <span className={cn("text-sm", "font-medium")}>Plan</span>
              <Select
                value={selectedPlanId}
                onValueChange={setSelectedPlanId}
                disabled={plansQuery.query.isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={cn("flex", "flex-col", "gap-2")}>
              <span className={cn("text-sm", "font-medium")}>
                Billing interval
              </span>
              <Select
                value={billingInterval}
                onValueChange={(value) =>
                  setBillingInterval(value as BillingInterval)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BILLING_INTERVAL_LABELS) as BillingInterval[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {BILLING_INTERVAL_LABELS[value]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setChangeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || !selectedPlanId}
              onClick={() => void handleAssign()}
            >
              {busy ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Assign plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

TenantSubscriptionCard.displayName = "TenantSubscriptionCard";
