import { SubscriptionStatus } from '../../constants/subscription-status.enum';
import {
  isSubscriptionActive,
  isSubscriptionUsable,
} from '../../utils/subscription-state';

const at = (
  status: SubscriptionStatus,
  dates: {
    currentPeriodEnd?: Date | null;
    trialEnd?: Date | null;
  } = {},
) => ({
  status,
  currentPeriodEnd: dates.currentPeriodEnd ?? null,
  trialEnd: dates.trialEnd ?? null,
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
    const now = new Date('2026-06-15T00:00:00.000Z');
    const future = new Date('2026-06-30T00:00:00.000Z');
    const past = new Date('2026-05-31T00:00:00.000Z');

    it.each([
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PAST_DUE,
      SubscriptionStatus.CANCELED,
    ])('%s is usable only before currentPeriodEnd', (status) => {
      expect(
        isSubscriptionUsable(at(status, { currentPeriodEnd: future }), now),
      ).toBe(true);
      expect(
        isSubscriptionUsable(at(status, { currentPeriodEnd: past }), now),
      ).toBe(false);
      expect(isSubscriptionUsable(at(status), now)).toBe(false);
    });

    it('TRIALING is usable only before trialEnd', () => {
      expect(
        isSubscriptionUsable(
          at(SubscriptionStatus.TRIALING, { trialEnd: future }),
          now,
        ),
      ).toBe(true);
      expect(
        isSubscriptionUsable(
          at(SubscriptionStatus.TRIALING, { trialEnd: past }),
          now,
        ),
      ).toBe(false);
      expect(isSubscriptionUsable(at(SubscriptionStatus.TRIALING), now)).toBe(
        false,
      );
    });

    it('keeps an ACTIVE perpetual plan usable', () => {
      expect(
        isSubscriptionUsable(
          at(SubscriptionStatus.ACTIVE, { currentPeriodEnd: past }),
          now,
          true,
        ),
      ).toBe(true);
    });

    it('rejects the remaining statuses and a missing subscription', () => {
      for (const status of [
        SubscriptionStatus.UNPAID,
        SubscriptionStatus.INCOMPLETE,
        SubscriptionStatus.INCOMPLETE_EXPIRED,
        SubscriptionStatus.PAUSED,
      ]) {
        for (const end of [past, future]) {
          expect(
            isSubscriptionUsable(
              at(status, { currentPeriodEnd: end, trialEnd: end }),
              now,
            ),
          ).toBe(false);
        }
      }
      expect(isSubscriptionUsable(null)).toBe(false);
    });
  });
});
