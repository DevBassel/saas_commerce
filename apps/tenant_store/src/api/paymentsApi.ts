import { apiClient } from "./apiClient";

export type StripePaymentIntentResponse = { clientSecret: string | null };

/**
 * Tracks the in-flight intent request per order. A second caller (React
 * StrictMode double-invoking the effect, a remount, or two mounts) shares the
 * same request instead of creating a duplicate Stripe PaymentIntent. The entry
 * is dropped once it settles, so an explicit retry starts a fresh intent.
 */
const inFlight = new Map<number, Promise<StripePaymentIntentResponse>>();

export function CreateStripePayment(
  orderId: number,
): Promise<StripePaymentIntentResponse> {
  const existing = inFlight.get(orderId);
  if (existing) return existing;

  const request = apiClient
    .post<StripePaymentIntentResponse>("/payments/stripe", { orderId })
    .then((res) => res.data)
    .finally(() => {
      inFlight.delete(orderId);
    });

  inFlight.set(orderId, request);
  return request;
}
