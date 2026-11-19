import { apiClient } from "./client";
import type {
  BillingInterval,
  CancelSubscriptionResponse,
  CreateSubscriptionPaymentResponse,
  Subscription,
  SubscriptionPlan,
  UsageSummary,
} from "@/types/subscription";

/**
 * Tracks the in-flight intent request per (plan, interval). React StrictMode
 * invokes the checkout dialog's mount effect twice, so both callers share one
 * request and only a single `SubscriptionPayment PENDING` row is created. The
 * entry is dropped once it settles, so an explicit Retry starts a fresh intent.
 */
const inFlight = new Map<string, Promise<CreateSubscriptionPaymentResponse>>();

const createPaymentIntent = (
  planId: number,
  billingInterval: BillingInterval,
): Promise<CreateSubscriptionPaymentResponse> => {
  const key = `${planId}:${billingInterval}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = apiClient
    .post<CreateSubscriptionPaymentResponse>("payments/stripe/subscription", {
      planId,
      billingInterval,
    })
    .then((response) => response.data)
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
};

export const subscriptionsApi = {
  getSubscription: async (): Promise<Subscription | null> => {
    const response = await apiClient.get<Subscription | null>("subscription");
    return response.data;
  },

  getPlans: async (): Promise<SubscriptionPlan[]> => {
    const response =
      await apiClient.get<SubscriptionPlan[]>("subscription/plans");
    return response.data;
  },

  getUsage: async (): Promise<UsageSummary> => {
    const response = await apiClient.get<UsageSummary>("subscription/usage");
    return response.data;
  },

  cancelSubscription: async (): Promise<CancelSubscriptionResponse> => {
    const response = await apiClient.post<CancelSubscriptionResponse>(
      "payments/stripe/subscription/cancel",
    );
    return response.data;
  },

  createPaymentIntent,
};
