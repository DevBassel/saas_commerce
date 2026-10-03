import { SubscriptionStatus } from '../constants/subscription-status.enum';

export interface SubscriptionStateLike {
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
}

/** Active means strictly `ACTIVE`. Used for billing-facing reporting. */
export const isSubscriptionActive = (
  subscription?: SubscriptionStateLike | null,
): boolean => subscription?.status === SubscriptionStatus.ACTIVE;

/**
 * Usable is the enforcement gate: a subscription counts while it is in good
 * standing (`TRIALING | ACTIVE | PAST_DUE`) or has been cancelled but is still
 * paid through its current period. Everything else is not usable.
 */
export const isSubscriptionUsable = (
  subscription?: SubscriptionStateLike | null,
  now: Date = new Date(),
): boolean => {
  if (!subscription) return false;

  if (
    subscription.status === SubscriptionStatus.TRIALING ||
    subscription.status === SubscriptionStatus.ACTIVE ||
    subscription.status === SubscriptionStatus.PAST_DUE
  ) {
    return true;
  }

  if (
    subscription.status === SubscriptionStatus.CANCELED &&
    subscription.currentPeriodEnd != null
  ) {
    return subscription.currentPeriodEnd.getTime() > now.getTime();
  }

  return false;
};
