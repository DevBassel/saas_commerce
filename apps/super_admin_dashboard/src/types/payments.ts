export type StripeAccountStatus = {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export type PlatformPaymentTenant = {
  id: number;
  name: string;
  slug: string;
  subdomain: string | null;
  status: string;
  stripeAccountId: string | null;
  paymentsPaused: boolean;
  payoutsPaused: boolean;
};

export type BalanceEntry = {
  amount: number;
  currency: string;
};

export type PlatformBalance = {
  available: BalanceEntry[];
  pending: BalanceEntry[];
};

export type PlatformPayout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  arrivalDate: number;
  created: number;
  description: string | null;
};

export type PlatformCharge = {
  id: number;
  orderId: number;
  orderNumber: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentRef: string | null;
  refundedAmount: number;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
};

export type PauseFlags = {
  paymentsPaused: boolean;
  payoutsPaused: boolean;
};

export type PlatformPaymentOverview = {
  tenant: {
    id: number;
    name: string;
    slug: string;
    subdomain: string | null;
    status: string;
    schemaName: string;
    stripeAccountId: string | null;
  };
  account: StripeAccountStatus;
  balance: PlatformBalance | null;
  payoutScheduleInterval: string | null;
  paymentsPaused: boolean;
  payoutsPaused: boolean;
};

export type PlatformChargesResponse = {
  data: PlatformCharge[];
  total: number;
  page: number;
  limit: number;
};

export type PlatformPayoutsResponse = {
  data: PlatformPayout[];
  hasMore: boolean;
  nextCursor: string | null;
};
