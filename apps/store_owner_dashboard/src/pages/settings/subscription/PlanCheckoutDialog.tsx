"use client";

import { SyntheticEvent, useEffect, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { toApiError } from "@/api/client";
import { subscriptionsApi } from "@/api/subscriptions.api";
import { getGuardTenantSlug, withTenantParam } from "@/api/tenant";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { priceFor } from "@/lib/subscription";
import { stripePromise } from "@/lib/stripe";
import { formatCurrency } from "@/lib/utils";
import type { BillingInterval, SubscriptionPlan } from "@/types/subscription";

type PlanCheckoutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan | null;
  billingInterval: BillingInterval;
  onPaid: (planId: number) => void;
};

type PaymentFormProps = {
  plan: SubscriptionPlan;
  billingInterval: BillingInterval;
  onPaid: (planId: number) => void;
};

function PaymentForm({ plan, billingInterval, onPaid }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const price = priceFor(plan, billingInterval);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${withTenantParam(
            `/settings/subscription?stripe=return&plan=${plan.id}`,
            getGuardTenantSlug(),
          )}`,
        },
        redirect: "if_required",
      });

      if (error) {
        toast.error(error.message ?? "Payment failed");
        return;
      }

      onPaid(plan.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">
          {plan.name} · {billingInterval === "YEARLY" ? "Yearly" : "Monthly"}
        </span>
        <span className="text-lg font-semibold">
          {formatCurrency(price, plan.currency)}
        </span>
      </div>

      <PaymentElement />

      <Button type="submit" disabled={!stripe || !elements || submitting}>
        {submitting ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          `Pay ${formatCurrency(price, plan.currency)}`
        )}
      </Button>
    </form>
  );
}

type PlanCheckoutProps = {
  plan: SubscriptionPlan;
  billingInterval: BillingInterval;
  onPaid: (planId: number) => void;
};

function PlanCheckout({ plan, billingInterval, onPaid }: PlanCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // React StrictMode invokes mount effects twice in development. Both
    // invocations call createPaymentIntent, which shares one in-flight request
    // per (planId, interval), so only one SubscriptionPayment row is created;
    // this run still receives the shared result and drives the state below.
    let active = true;

    const createIntent = async () => {
      try {
        const { clientSecret: secret } =
          await subscriptionsApi.createPaymentIntent(plan.id, billingInterval);
        if (!active) return;
        if (!secret) throw new Error("Payment could not be initialized");
        setClientSecret(secret);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(toApiError(e).message);
      } finally {
        if (active) setCreating(false);
      }
    };

    void createIntent();

    return () => {
      active = false;
    };
  }, [plan.id, billingInterval, attempt]);

  const handleRetry = () => {
    setError(null);
    setClientSecret(null);
    setCreating(true);
    setAttempt((current) => current + 1);
  };

  if (stripePromise === null) {
    return (
      <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
        Payments are not configured for this store.
      </p>
    );
  }

  if (creating) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Preparing payment…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
        <Button type="button" variant="outline" onClick={handleRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: "night" } }}
    >
      <PaymentForm
        plan={plan}
        billingInterval={billingInterval}
        onPaid={onPaid}
      />
    </Elements>
  );
}

export const PlanCheckoutDialog = ({
  open,
  onOpenChange,
  plan,
  billingInterval,
  onPaid,
}: PlanCheckoutDialogProps) => {
  const price = plan ? priceFor(plan, billingInterval) : null;
  const intervalWord = billingInterval === "YEARLY" ? "year" : "month";

  return (
    <Dialog open={open} modal={false} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {plan ? `Upgrade to ${plan.name}` : "Upgrade plan"}
          </DialogTitle>
          <DialogDescription>
            {plan && price != null
              ? `${formatCurrency(price, plan.currency)} per ${intervalWord}. Enter your card details to activate this plan.`
              : "Complete your subscription purchase."}
          </DialogDescription>
        </DialogHeader>

        {plan ? (
          <PlanCheckout
            key={`${plan.id}:${billingInterval}`}
            plan={plan}
            billingInterval={billingInterval}
            onPaid={onPaid}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

PlanCheckoutDialog.displayName = "PlanCheckoutDialog";
