import { SubscriptionStatus } from '../constants/subscription-status.enum';

export interface SubscriptionStateLike {
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
  trialEnd?: Date | null;
}

/** Active means strictly `ACTIVE`. Used for billing-facing reporting. */
export const isSubscriptionActive = (
  subscription?: SubscriptionStateLike | null,
): boolean => subscription?.status === SubscriptionStatus.ACTIVE;

/**
 * Usable is the enforcement gate. Trials are bounded by `trialEnd`; paid,
 * overdue, and cancelled subscriptions are bounded by `currentPeriodEnd`.
 * The caller may explicitly mark an ACTIVE plan as perpetual (the free plan).
 */
export const isSubscriptionUsable = (
  subscription?: SubscriptionStateLike | null,
  now: Date = new Date(),
  isPerpetual = false,
): boolean => {
  if (!subscription) return false;

  if (isPerpetual && subscription.status === SubscriptionStatus.ACTIVE)
    return true;

  const accessEnd =
    subscription.status === SubscriptionStatus.TRIALING
      ? subscription.trialEnd
      : subscription.currentPeriodEnd;

  if (
    (subscription.status === SubscriptionStatus.TRIALING ||
      subscription.status === SubscriptionStatus.ACTIVE ||
      subscription.status === SubscriptionStatus.PAST_DUE ||
      subscription.status === SubscriptionStatus.CANCELED) &&
    accessEnd != null
  ) {
    return accessEnd.getTime() > now.getTime();
  }

  return false;
};
