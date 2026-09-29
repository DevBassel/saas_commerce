"use client";

import { useEffect, useRef, useState } from "react";
import { useCustom, useNotification } from "@refinedev/core";
import { Loader2 } from "lucide-react";

import { toApiError } from "@/api/client";
import { paymentsApi } from "@/api/payments.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  isOnboardingComplete,
  type StripeAccountStatus,
} from "@/types/payments";

const StatusRow = ({ label, enabled }: { label: string; enabled: boolean }) => (
  <div className={cn("flex", "items-center", "justify-between", "py-2")}>
    <span className="text-sm text-muted-foreground">{label}</span>
    <Badge variant={enabled ? "default" : "secondary"}>
      {enabled ? "Enabled" : "Pending"}
    </Badge>
  </div>
);

export const StripePayments = () => {
  const { open } = useNotification();
  const [busy, setBusy] = useState(false);
  const handledReturn = useRef(false);

  const { query } = useCustom<StripeAccountStatus>({
    url: "payments/stripe/account",
    method: "get",
  });

  const { refetch } = query;

  useEffect(() => {
    if (handledReturn.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") !== "return") return;
    handledReturn.current = true;
    open?.({
      type: "success",
      message: "Stripe onboarding submitted",
      description: "Your account status has been refreshed.",
    });
    void refetch();
  }, [open, refetch]);

  const handleConnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await paymentsApi.connect();
      window.location.assign(url);
    } catch (error) {
      open?.({
        type: "error",
        message: "Failed to start Stripe onboarding",
        description: toApiError(error).message,
      });
      setBusy(false);
    }
  };

  const status = query.data?.data;
  const apiError = query.error ? toApiError(query.error) : null;
  const isForbidden = apiError?.statusCode === 403;
  const isComplete = status ? isOnboardingComplete(status) : false;

  const connectLabel = !status?.connected
    ? "Connect with Stripe"
    : isComplete
      ? "Update account details"
      : "Continue onboarding";

  const connectButton = (
    <Button type="button" disabled={busy} onClick={handleConnect}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {connectLabel}
    </Button>
  );

  return (
    <div className={cn("flex", "flex-col", "gap-6", "p-4")}>
      <div className={cn("flex", "flex-col", "gap-1")}>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Connect a Stripe account to accept payments from your customers.
        </p>
      </div>

      {query.isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className={cn("flex", "flex-col", "gap-3")}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : isForbidden ? (
        <Card>
          <CardHeader>
            <CardTitle>Not authorized</CardTitle>
            <CardDescription>
              You do not have permission to manage payments. Ask a store owner
              or admin to configure Stripe.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : apiError ? (
        <Card>
          <CardHeader>
            <CardTitle>Could not load payment status</CardTitle>
            <CardDescription>{apiError.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !status?.connected ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect with Stripe</CardTitle>
            <CardDescription>
              Set up a Stripe account to start accepting card payments. You will
              be redirected to Stripe to complete onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent>{connectButton}</CardContent>
        </Card>
      ) : !isComplete ? (
        <Card>
          <CardHeader>
            <CardTitle>Continue onboarding</CardTitle>
            <CardDescription>
              Your Stripe onboarding is not complete. Continue to finish
              submitting your account details.
            </CardDescription>
          </CardHeader>
          <CardContent>{connectButton}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader
            className={cn(
              "flex",
              "flex-row",
              "items-center",
              "justify-between",
            )}
          >
            <div className={cn("flex", "flex-col", "gap-1")}>
              <CardTitle>Stripe account</CardTitle>
              <CardDescription>
                Your account is active and can accept payments.
              </CardDescription>
            </div>
            <Badge variant="default">Active</Badge>
          </CardHeader>
          <CardContent className={cn("flex", "flex-col", "gap-4")}>
            <div className={cn("flex", "flex-col")}>
              <StatusRow label="Charges" enabled={status.chargesEnabled} />
              <Separator />
              <StatusRow label="Payouts" enabled={status.payoutsEnabled} />
              <Separator />
              <StatusRow
                label="Details submitted"
                enabled={status.detailsSubmitted}
              />
            </div>
            {connectButton}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

StripePayments.displayName = "StripePayments";
