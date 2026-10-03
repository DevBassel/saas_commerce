import { SubscriptionStatus } from '../constants/subscription-status.enum';
import {
  isSubscriptionActive,
  isSubscriptionUsable,
} from './subscription-state';

const at = (
  status: SubscriptionStatus,
  currentPeriodEnd: Date | null = null,
) => ({
  status,
  currentPeriodEnd,
});

describe('subscription state', () => {
  describe('isSubscriptionActive', () => {
    it('is true only for ACTIVE', () => {
      expect(isSubscriptionActive(at(SubscriptionStatus.ACTIVE))).toBe(true);
      expect(isSubscriptionActive(at(SubscriptionStatus.TRIALING))).toBe(false);
      expect(isSubscriptionActive(at(SubscriptionStatus.PAST_DUE))).toBe(false);
      expect(isSubscriptionActive(null)).toBe(false);
    });
  });

  describe('isSubscriptionUsable', () => {
    it('accepts TRIALING, ACTIVE and PAST_DUE', () => {
      expect(isSubscriptionUsable(at(SubscriptionStatus.TRIALING))).toBe(true);
      expect(isSubscriptionUsable(at(SubscriptionStatus.ACTIVE))).toBe(true);
      expect(isSubscriptionUsable(at(SubscriptionStatus.PAST_DUE))).toBe(true);
    });

    it('accepts CANCELED until the period end passes', () => {
      const now = new Date('2026-06-15T00:00:00.000Z');
      const future = new Date('2026-06-30T00:00:00.000Z');
      const past = new Date('2026-05-31T00:00:00.000Z');

      expect(
        isSubscriptionUsable(at(SubscriptionStatus.CANCELED, future), now),
      ).toBe(true);
      expect(
        isSubscriptionUsable(at(SubscriptionStatus.CANCELED, past), now),
      ).toBe(false);
      expect(
        isSubscriptionUsable(at(SubscriptionStatus.CANCELED, null), now),
      ).toBe(false);
    });

    it('rejects the remaining statuses and a missing subscription', () => {
      for (const status of [
        SubscriptionStatus.UNPAID,
        SubscriptionStatus.INCOMPLETE,
        SubscriptionStatus.INCOMPLETE_EXPIRED,
        SubscriptionStatus.PAUSED,
      ]) {
        expect(isSubscriptionUsable(at(status))).toBe(false);
      }
      expect(isSubscriptionUsable(null)).toBe(false);
    });
  });
});
