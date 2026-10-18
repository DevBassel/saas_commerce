import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';

export interface paymentMetaData {
  orderId: number;
  userId: number;
  tenant: string;
}

export interface subscriptionPaymentMetaData {
  kind: 'subscription';
  subscriptionId: number;
  tenantId: number;
  planId: number;
  billingInterval: BillingInterval;
  tenant: string;
}

export const isSubscriptionPaymentMetaData = (
  data: paymentMetaData | subscriptionPaymentMetaData,
): data is subscriptionPaymentMetaData =>
  'kind' in data && data.kind === 'subscription';
