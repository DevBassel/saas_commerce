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
import { Button } from "@/components/ui/button";
import { CreateStripePayment } from "@/api/paymentsApi";
import { toApiError } from "@/api/handelError";
import { stripePromise } from "@/lib/stripe";

type StripePaymentStepProps = {
  orderId: number;
  orderNumber?: string;
  amount: number;
  onSuccess: () => void;
};

type PaymentFormProps = {
  orderNumber?: string;
  amount: number;
  onSuccess: () => void;
};

function PaymentForm({ orderNumber, amount, onSuccess }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders?payment=return`,
        },
        redirect: "if_required",
      });

      if (error) {
        toast.error(error.message ?? "Payment failed");
        return;
      }

      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        {orderNumber && (
          <span className="text-muted-foreground">
            Order <span className="font-medium">#{orderNumber}</span>
          </span>
        )}
        <span className="text-lg font-semibold">${amount.toFixed(2)}</span>
      </div>

      <PaymentElement />

      <Button type="submit" disabled={!stripe || !elements || submitting}>
        {submitting ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          `Pay $${amount.toFixed(2)}`
        )}
      </Button>
    </form>
  );
}

export default function StripePaymentStep({
  orderId,
  orderNumber,
  amount,
  onSuccess,
}: StripePaymentStepProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    const createIntent = async () => {
      try {
        const { clientSecret: secret } = await CreateStripePayment(orderId);
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
  }, [orderId, attempt]);

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
        orderNumber={orderNumber}
        amount={amount}
        onSuccess={onSuccess}
      />
    </Elements>
  );
}
