import { PlatformPaymentsService } from './platform-payments.service';
import { TenantService } from '../../tenants/tenant.service';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import StripePaymentService from '../../payments/stripe.payment.service';

type StripeMock = {
  getPlatformAccountStatus: jest.Mock;
  getPlatformBalance: jest.Mock;
};

const buildMocks = () => {
  const stripePaymentService: StripeMock = {
    getPlatformAccountStatus: jest.fn(),
    getPlatformBalance: jest.fn(),
  };

  const service = new PlatformPaymentsService(
    {} as unknown as TenantService,
    {} as unknown as TenantManagerService,
    stripePaymentService as unknown as StripePaymentService,
  );

  return { service, stripePaymentService };
};

describe('PlatformPaymentsService.getSummary', () => {
  it('returns the platform account, balance and a null error on success', async () => {
    const { service, stripePaymentService } = buildMocks();
    stripePaymentService.getPlatformAccountStatus.mockResolvedValue({
      connected: true,
      accountId: 'acct_platform',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
    stripePaymentService.getPlatformBalance.mockResolvedValue({
      available: [{ amount: 12345, currency: 'usd' }],
      pending: [],
    });

    await expect(service.getSummary()).resolves.toEqual({
      account: {
        connected: true,
        accountId: 'acct_platform',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      },
      balance: {
        available: [{ amount: 12345, currency: 'usd' }],
        pending: [],
      },
      error: null,
    });
  });

  it('degrades to nulls and a generic error when Stripe throws', async () => {
    const { service, stripePaymentService } = buildMocks();
    stripePaymentService.getPlatformAccountStatus.mockRejectedValue(
      new Error('Invalid API Key provided: sk_live_secret'),
    );
    stripePaymentService.getPlatformBalance.mockResolvedValue({
      available: [],
      pending: [],
    });

    await expect(service.getSummary()).resolves.toEqual({
      account: null,
      balance: null,
      error: 'Stripe is unavailable',
    });
  });
});
