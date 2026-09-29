export interface StripeAccountStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export const isOnboardingComplete = (
  status: StripeAccountStatus,
): boolean =>
  status.connected &&
  status.chargesEnabled &&
  status.payoutsEnabled &&
  status.detailsSubmitted;
