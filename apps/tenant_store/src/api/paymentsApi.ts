import { apiClient } from "./apiClient";

export type StripePaymentIntentResponse = { clientSecret: string | null };

export async function CreateStripePayment(
  orderId: number,
): Promise<StripePaymentIntentResponse> {
  const res = await apiClient.post<StripePaymentIntentResponse>(
    "/payments/stripe",
    { orderId },
  );
  return res.data;
}
