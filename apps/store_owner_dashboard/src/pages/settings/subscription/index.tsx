"use client";

import { useCallback, useEffect, useState } from "react";
import { useCustom } from "@refinedev/core";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { toApiError } from "@/api/client";
import { subscriptionsApi } from "@/api/subscriptions.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BILLING_INTERVAL_LABELS,
  FEATURE_LABELS,
  LIMIT_KEYS,
  LIMIT_LABELS,
  LIMIT_TYPE_BY_KEY,
  STATUS_LABELS,
  formatLimitValue,
} from "@/lib/subscription";
import { cn, formatBytes, formatCurrency, storagePercent } from "@/lib/utils";
import type {
  BillingInterval,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  UsageSummary,
  UsageValue,
} from "@/types/subscription";
import { PlanCheckoutDialog } from "./PlanCheckoutDialog";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";

const STATUS_VARIANT: Record<
  SubscriptionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  TRIALING: "secondary",
  ACTIVE: "default",
  PAST_DUE: "destructive",
  CANCELED: "outline",
  UNPAID: "destructive",
  INCOMPLETE: "secondary",
  INCOMPLETE_EXPIRED: "outline",
  PAUSED: "secondary",
};

const BILLING_INTERVALS: BillingInterval[] = ["MONTHLY", "YEARLY"];

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "—";

const formatUsed = (value: number, type: "BYTES" | "COUNT") =>
  type === "BYTES" ? formatBytes(value) : value.toLocaleString();

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className={cn("flex", "flex-col", "gap-1")}>
    <span className={cn("text-xs", "text-muted-foreground")}>{label}</span>
    <span>{value}</span>
  </div>
);

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
      <div
        className={cn(
          "flex",
          "flex-col",
          "items-start",
          "gap-1",
          "sm:flex-row",
          "sm:items-center",
          "sm:justify-between",
          "sm:gap-2",
        )}
      >
        <span className={cn("text-sm", "font-medium")}>{label}</span>
        <span className={cn("text-sm", "text-muted-foreground")}>
          {formatUsed(value.used, type)} / {formatLimitValue(value.limit, type)}
        </span>
      </div>
      {percent == null ? (
        <span className={cn("text-xs", "text-muted-foreground")}>
          Unlimited
        </span>
      ) : (
        <div
          className={cn(
            "h-2",
            "w-full",
            "overflow-hidden",
            "rounded-full",
            "bg-secondary",
          )}
        >
          <div
            className={cn("h-full", "rounded-full", "bg-primary")}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const SubscriptionSettings = () => {
  const subscriptionQuery = useCustom<Subscription>({
    url: "subscription",
    method: "get",
  });
  const usageQuery = useCustom<UsageSummary>({
    url: "subscription/usage",
    method: "get",
  });
  const plansQuery = useCustom<SubscriptionPlan[]>({
    url: "subscription/plans",
    method: "get",
  });

  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("MONTHLY");

  const { refetch: refetchSubscription } = subscriptionQuery.query;
  const { refetch: refetchUsage } = usageQuery.query;
  const { refetch: refetchPlans } = plansQuery.query;

  const subscription: Subscription | null =
    subscriptionQuery.query.data?.data ?? null;
  const usage = usageQuery.query.data?.data;
  const plans = plansQuery.query.data?.data ?? [];

  const freePlan = plans.find((plan) => plan.slug === "free") ?? null;
  const effectivePlan = subscription?.plan ?? freePlan;
  const defaultPlan =
    plans.find((plan) => plan.id === effectivePlan?.id) ?? plans[0] ?? null;
  const planName = effectivePlan?.name ?? "Free";
  const currency = effectivePlan?.currency ?? "usd";
  const price =
    effectivePlan == null
      ? null
      : subscription?.billingInterval === "YEARLY"
        ? effectivePlan.yearlyPrice
        : effectivePlan.monthlyPrice;

  const errorSource =
    subscriptionQuery.query.error ??
    usageQuery.query.error ??
    plansQuery.query.error;
  const apiError = errorSource ? toApiError(errorSource) : null;
  const isLoading =
    subscriptionQuery.query.isLoading || usageQuery.query.isLoading;

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchSubscription(), refetchUsage(), refetchPlans()]);
  }, [refetchSubscription, refetchUsage, refetchPlans]);

  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(
    null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | null>(
    null,
  );

  const handlePaid = useCallback((planId: number) => {
    setCheckoutPlan(null);
    setPendingPlanId(planId);
    setProcessingMessage("Completing your purchase…");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") !== "return") return;

    const planParam = params.get("plan");
    const returnedPlanId =
      planParam != null && planParam !== "" ? Number(planParam) : Number.NaN;
    const status = params.get("redirect_status");
    const completesPolling =
      status === "succeeded" ||
      status === "processing" ||
      status === "requires_action";

    if (Number.isFinite(returnedPlanId) && completesPolling) {
      setPendingPlanId(returnedPlanId);
      setProcessingMessage("Completing your purchase…");
    } else if (status) {
      toast.error("Payment was not completed. Please try again.");
    }

    const url = new URL(window.location.href);
    [
      "stripe",
      "plan",
      "redirect_status",
      "payment_intent",
      "payment_intent_client_secret",
    ].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(
      null,
      "",
      `${url.pathname}?${url.searchParams.toString()}${url.hash}`,
    );
  }, []);

  useEffect(() => {
    if (pendingPlanId == null) return;

    let cancelled = false;
    const startedAt = Date.now();
    const timeoutMs = 30_000;
    let timer: number;

    const poll = async () => {
      try {
        const current = await subscriptionsApi.getSubscription();
        if (cancelled) return;
        if (current?.planId === pendingPlanId) {
          setPendingPlanId(null);
          setProcessingMessage(null);
          toast.success("Plan activated");
          await refetchAll();
          return;
        }
      } catch {
        // Transient failure; keep polling until the timeout.
      }
      if (cancelled) return;
      if (Date.now() - startedAt >= timeoutMs) {
        setPendingPlanId(null);
        setProcessingMessage(
          "Payment is still processing — refresh in a moment.",
        );
        return;
      }
      timer = window.setTimeout(poll, 2_000);
    };

    timer = window.setTimeout(poll, 2_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pendingPlanId, refetchAll]);

  const intervalToggle = (
    <div className={cn("inline-flex", "gap-1", "rounded-md", "border", "p-1")}>
      {BILLING_INTERVALS.map((interval) => (
        <Button
          key={interval}
          type="button"
          size="sm"
          variant={billingInterval === interval ? "default" : "ghost"}
          onClick={() => setBillingInterval(interval)}
        >
          {BILLING_INTERVAL_LABELS[interval]}
        </Button>
      ))}
    </div>
  );

  return (
    <div className={cn("flex", "flex-col", "gap-6", "p-4")}>
      <div className={cn("flex", "flex-col", "gap-1")}>
        <h1 className="text-2xl font-semibold">Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Manage your plan and review live usage.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className={cn("flex", "flex-col", "gap-3")}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : apiError ? (
        <Card>
          <CardHeader>
            <CardTitle>Could not load subscription</CardTitle>
            <CardDescription>{apiError.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetchAll()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {processingMessage ? (
            <div
              className={cn(
                "rounded-md",
                "border",
                "bg-muted/40",
                "p-3",
                "text-sm",
                "text-muted-foreground",
              )}
            >
              {processingMessage}
            </div>
          ) : null}

          <Card>
            <CardHeader
              className={cn(
                "flex",
                "flex-row",
                "items-center",
                "justify-between",
                "gap-4",
              )}
            >
              <div className={cn("flex", "flex-col", "gap-1")}>
                <CardTitle>Current plan</CardTitle>
                <CardDescription>
                  {effectivePlan?.description ?? "Your store's subscription"}
                </CardDescription>
              </div>
              {subscription ? (
                <Badge variant={STATUS_VARIANT[subscription.status]}>
                  {STATUS_LABELS[subscription.status]}
                </Badge>
              ) : (
                <Badge variant="secondary">Free</Badge>
              )}
            </CardHeader>
            <CardContent className={cn("flex", "flex-col", "gap-6")}>
              <div
                className={cn(
                  "grid",
                  "gap-4",
                  "sm:grid-cols-2",
                  "lg:grid-cols-4",
                )}
              >
                <Field label="Plan" value={planName} />
                <Field
                  label="Billing interval"
                  value={
                    subscription
                      ? BILLING_INTERVAL_LABELS[subscription.billingInterval]
                      : "—"
                  }
                />
                <Field
                  label="Price"
                  value={price != null ? formatCurrency(price, currency) : "—"}
                />
                <Field
                  label="Current period"
                  value={
                    subscription
                      ? `${formatDate(subscription.currentPeriodStart)} – ${formatDate(subscription.currentPeriodEnd)}`
                      : "—"
                  }
                />
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

              {!subscription ? (
                <p className="text-sm text-muted-foreground">
                  No active subscription. Showing the free plan limits.
                </p>
              ) : null}

              {subscription?.refundEligible ? (
                <div
                  className={cn(
                    "flex",
                    "flex-col",
                    "gap-2",
                    "border-t",
                    "pt-4",
                  )}
                >
                  <p className={cn("text-sm", "text-muted-foreground")}>
                    Refund available until{" "}
                    {formatDate(subscription.refundDeadline)}
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    className={cn(
                      "h-auto",
                      "w-full",
                      "whitespace-normal",
                      "text-center",
                      "sm:w-auto",
                      "sm:self-start",
                    )}
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel subscription &amp; request refund
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>
                Live values from your store, measured against the plan limits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "grid",
                  "gap-3",
                  "sm:grid-cols-2",
                  "lg:grid-cols-4",
                )}
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
            </CardContent>
          </Card>

          {plans.length ? (
            <Card>
              <CardHeader
                className={cn(
                  "flex",
                  "flex-col",
                  "gap-3",
                  "sm:flex-row",
                  "sm:items-center",
                  "sm:justify-between",
                )}
              >
                <div className={cn("flex", "flex-col", "gap-1")}>
                  <CardTitle>Available plans</CardTitle>
                  <CardDescription>
                    Select a plan to see its limits and features.
                  </CardDescription>
                </div>
                {intervalToggle}
              </CardHeader>
              <CardContent>
                <Tabs
                  defaultValue={
                    defaultPlan ? String(defaultPlan.id) : undefined
                  }
                >
                  <TabsList
                    className={cn(
                      "h-auto",
                      "w-full",
                      "flex-wrap",
                      "justify-start",
                    )}
                  >
                    {plans.map((plan) => {
                      const isCurrent = effectivePlan?.id === plan.id;
                      return (
                        <TabsTrigger
                          key={plan.id}
                          value={String(plan.id)}
                          className="h-auto basis-full whitespace-normal sm:basis-0"
                        >
                          {plan.name}
                          {isCurrent ? (
                            <Badge variant="secondary">Current</Badge>
                          ) : null}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  {plans.map((plan) => {
                    const isCurrent = effectivePlan?.id === plan.id;
                    const billable =
                      plan.monthlyPrice > 0 || plan.yearlyPrice > 0;
                    return (
                      <TabsContent
                        key={plan.id}
                        value={String(plan.id)}
                        className={cn("mt-4")}
                      >
                        <div
                          className={cn(
                            "overflow-hidden",
                            "rounded-lg",
                            "border",
                            isCurrent &&
                              "border-primary/50 ring-1 ring-primary/20",
                          )}
                        >
                          <div
                            className={cn(
                              "flex",
                              "flex-col",
                              "gap-1",
                              "border-b",
                              "bg-muted/40",
                              "p-4",
                            )}
                          >
                            <div
                              className={cn(
                                "flex",
                                "items-center",
                                "justify-between",
                                "flex-wrap",
                                "gap-2",
                              )}
                            >
                              <span
                                className={cn(
                                  "min-w-0",
                                  "text-lg",
                                  "font-semibold",
                                  "[overflow-wrap:anywhere]",
                                )}
                              >
                                {plan.name}
                              </span>
                              {isCurrent ? <Badge>Current plan</Badge> : null}
                            </div>
                            <p
                              className={cn("text-sm", "text-muted-foreground")}
                            >
                              {plan.description ?? "No description."}
                            </p>
                          </div>

                          <div
                            className={cn(
                              "grid",
                              "gap-3",
                              "border-b",
                              "p-4",
                              "sm:grid-cols-2",
                            )}
                          >
                            <div
                              className={cn(
                                "flex",
                                "flex-col",
                                "gap-0.5",
                                "rounded-md",
                                "bg-muted/40",
                                "p-3",
                                billingInterval === "MONTHLY" &&
                                  "ring-1 ring-primary",
                              )}
                            >
                              <span
                                className={cn(
                                  "text-xs",
                                  "font-medium",
                                  "text-muted-foreground",
                                )}
                              >
                                Monthly
                              </span>
                              <span className={cn("text-2xl", "font-semibold")}>
                                {formatCurrency(
                                  plan.monthlyPrice,
                                  plan.currency,
                                )}
                              </span>
                              <span
                                className={cn(
                                  "text-xs",
                                  "text-muted-foreground",
                                )}
                              >
                                per month
                              </span>
                            </div>
                            <div
                              className={cn(
                                "flex",
                                "flex-col",
                                "gap-0.5",
                                "rounded-md",
                                "bg-muted/40",
                                "p-3",
                                billingInterval === "YEARLY" &&
                                  "ring-1 ring-primary",
                              )}
                            >
                              <span
                                className={cn(
                                  "text-xs",
                                  "font-medium",
                                  "text-muted-foreground",
                                )}
                              >
                                Yearly
                              </span>
                              <span className={cn("text-2xl", "font-semibold")}>
                                {formatCurrency(
                                  plan.yearlyPrice,
                                  plan.currency,
                                )}
                              </span>
                              <span
                                className={cn(
                                  "text-xs",
                                  "text-muted-foreground",
                                )}
                              >
                                per year
                              </span>
                            </div>
                          </div>

                          <div
                            className={cn(
                              "flex",
                              "flex-col",
                              "gap-3",
                              "border-b",
                              "p-4",
                            )}
                          >
                            <span className={cn("text-sm", "font-medium")}>
                              Limits
                            </span>
                            <div
                              className={cn(
                                "grid",
                                "gap-2",
                                "sm:grid-cols-2",
                                "lg:grid-cols-3",
                              )}
                            >
                              {LIMIT_KEYS.map((key) => {
                                const limit = plan.limits.find(
                                  (item) => item.key === key,
                                );
                                return (
                                  <div
                                    key={key}
                                    className={cn(
                                      "flex",
                                      "items-center",
                                      "justify-between",
                                      "gap-2",
                                      "rounded-md",
                                      "border",
                                      "px-3",
                                      "py-2",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "text-xs",
                                        "text-muted-foreground",
                                      )}
                                    >
                                      {LIMIT_LABELS[key]}
                                    </span>
                                    <span
                                      className={cn("text-sm", "font-medium")}
                                    >
                                      {formatLimitValue(
                                        limit?.value ?? null,
                                        LIMIT_TYPE_BY_KEY[key],
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div
                            className={cn("flex", "flex-col", "gap-3", "p-4")}
                          >
                            <span className={cn("text-sm", "font-medium")}>
                              Features
                            </span>
                            {plan.features.length ? (
                              <ul
                                className={cn(
                                  "grid",
                                  "gap-2",
                                  "sm:grid-cols-2",
                                )}
                              >
                                {plan.features.map((feature) => (
                                  <li
                                    key={feature.key}
                                    className={cn(
                                      "flex",
                                      "items-center",
                                      "gap-2",
                                      "text-sm",
                                      !feature.enabled &&
                                        "text-muted-foreground",
                                    )}
                                  >
                                    {feature.enabled ? (
                                      <Check
                                        className={cn(
                                          "size-4",
                                          "shrink-0",
                                          "text-primary",
                                        )}
                                      />
                                    ) : (
                                      <X
                                        className={cn(
                                          "size-4",
                                          "shrink-0",
                                          "text-muted-foreground/60",
                                        )}
                                      />
                                    )}
                                    <span>{FEATURE_LABELS[feature.key]}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p
                                className={cn(
                                  "text-sm",
                                  "text-muted-foreground",
                                )}
                              >
                                No features listed.
                              </p>
                            )}
                          </div>

                          <div
                            className={cn("border-t", "bg-muted/40", "p-4")}
                          >
                            {isCurrent ? (
                              <Button
                                type="button"
                                variant="outline"
                                className={cn("w-full")}
                                disabled
                              >
                                Current plan
                              </Button>
                            ) : !billable ? (
                              <Button
                                type="button"
                                variant="outline"
                                className={cn("w-full")}
                                disabled
                              >
                                Free plan
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                className={cn("w-full")}
                                onClick={() => setCheckoutPlan(plan)}
                              >
                                Upgrade
                              </Button>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <PlanCheckoutDialog
        open={checkoutPlan !== null}
        onOpenChange={(next) => {
          if (!next) setCheckoutPlan(null);
        }}
        plan={checkoutPlan}
        billingInterval={billingInterval}
        onPaid={handlePaid}
      />

      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        deadline={subscription?.refundDeadline ?? null}
        onCancelled={() => void refetchAll()}
      />
    </div>
  );
};

SubscriptionSettings.displayName = "SubscriptionSettings";
