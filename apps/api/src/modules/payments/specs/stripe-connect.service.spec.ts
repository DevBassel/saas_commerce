import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IENV } from 'src/common/config/env.interface';
import { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { StripeConnectService } from '../stripe/services/stripe-connect.service';
import { StripeClientService } from '../stripe/stripe-client.service';

jest.mock('stripe', () => {
  class StripeInvalidRequestError extends Error {
    code?: string;

    constructor(message = 'invalid', code?: string) {
      super(message);
      this.code = code;
    }
  }

  const StripeMock = jest.fn() as unknown as {
    errors: { StripeInvalidRequestError: typeof StripeInvalidRequestError };
  };
  StripeMock.errors = { StripeInvalidRequestError };

  return { __esModule: true, default: StripeMock };
});

const StripeMock = Stripe as unknown as {
  errors: {
    StripeInvalidRequestError: new (
      message?: string,
      code?: string,
    ) => Error & { code?: string };
  };
};

const InvalidRequest = StripeMock.errors.StripeInvalidRequestError;
const TENANT_SCHEMA = 'tenant_acme';

const tenantEntity = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 3,
    schemaName: TENANT_SCHEMA,
    stripeAccountId: 'acct_1',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as Tenant;

const buildConfig = (
  overrides: {
    stripe?: Record<string, unknown>;
    app?: Record<string, unknown>;
    cors?: Record<string, unknown>;
  } = {},
): ConfigService<IENV> => {
  const values = {
    stripe: {
      secretKey: 'sk_test_123',
      publishableKey: 'pk_test_123',
      webhookSecret: 'whsec_123',
      applicationFeeBps: 0,
      ...overrides.stripe,
    },
    app: { rootDomain: 'example.com', ...overrides.app },
    cors: { origin: 'http://localhost:5174', ...overrides.cors },
  };

  return {
    getOrThrow: jest.fn((key: keyof typeof values) => values[key]),
  } as unknown as ConfigService<IENV>;
};

const buildMocks = (config = buildConfig()) => {
  const stripe = {
    accounts: {
      retrieve: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    balance: { retrieve: jest.fn() },
    payouts: { list: jest.fn() },
    accountLinks: { create: jest.fn() },
  };
  const stripeClient = {
    client: stripe,
  } as unknown as StripeClientService;

  return {
    service: new StripeConnectService(config, stripeClient),
    stripe,
  };
};

describe('StripeConnectService', () => {
  describe('account and balance helpers', () => {
    it('reports disconnected when the tenant has no Stripe account', async () => {
      const { service, stripe } = buildMocks();

      await expect(
        service.getAccountStatus(tenantEntity({ stripeAccountId: null })),
      ).resolves.toEqual({
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
      expect(stripe.accounts.retrieve).not.toHaveBeenCalled();
    });

    it('maps a retrieved account', async () => {
      const { service, stripe } = buildMocks();
      stripe.accounts.retrieve.mockResolvedValue({
        id: 'acct_1',
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
      });

      await expect(service.getAccountStatus(tenantEntity())).resolves.toEqual({
        connected: true,
        accountId: 'acct_1',
        chargesEnabled: true,
        payoutsEnabled: false,
        detailsSubmitted: true,
      });
      expect(stripe.accounts.retrieve).toHaveBeenCalledWith('acct_1');
    });

    it('maps a missing account to disconnected with the stored id', async () => {
      const { service, stripe } = buildMocks();
      stripe.accounts.retrieve.mockRejectedValue(
        new InvalidRequest('missing', 'resource_missing'),
      );

      await expect(service.getAccountStatus(tenantEntity())).resolves.toEqual({
        connected: false,
        accountId: 'acct_1',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
    });

    it('rethrows non-missing account errors', async () => {
      const { service, stripe } = buildMocks();
      const error = new Error('stripe down');
      stripe.accounts.retrieve.mockRejectedValue(error);

      await expect(service.getAccountStatus(tenantEntity())).rejects.toBe(
        error,
      );
    });

    it('reads and maps the platform account with a null id', async () => {
      const { service, stripe } = buildMocks();
      stripe.accounts.retrieve.mockResolvedValue({
        id: 'acct_platform',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      });

      await expect(service.getPlatformAccountStatus()).resolves.toEqual({
        connected: true,
        accountId: 'acct_platform',
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
      });
      expect(stripe.accounts.retrieve).toHaveBeenCalledWith(null);
    });

    it('returns a mapped balance for a connected account', async () => {
      const { service, stripe } = buildMocks();
      stripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 10, currency: 'usd' }],
        pending: [{ amount: 5, currency: 'usd' }],
      });

      await expect(service.getBalance('acct_1')).resolves.toEqual({
        available: [{ amount: 10, currency: 'usd' }],
        pending: [{ amount: 5, currency: 'usd' }],
      });
      expect(stripe.balance.retrieve).toHaveBeenCalledWith(
        {},
        { stripeAccount: 'acct_1' },
      );
    });

    it('returns null for a missing balance account', async () => {
      const { service, stripe } = buildMocks();
      stripe.balance.retrieve.mockRejectedValue(
        new InvalidRequest('missing', 'account_invalid'),
      );

      await expect(service.getBalance('acct_1')).resolves.toBeNull();
    });

    it('reads and maps the platform balance without an account', async () => {
      const { service, stripe } = buildMocks();
      stripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 20, currency: 'usd' }],
        pending: [],
      });

      await expect(service.getPlatformBalance()).resolves.toEqual({
        available: [{ amount: 20, currency: 'usd' }],
        pending: [],
      });
      expect(stripe.balance.retrieve).toHaveBeenCalledWith();
    });

    it('lists payouts with clamping handled by the caller', async () => {
      const { service, stripe } = buildMocks();
      const payouts = { data: [], has_more: false };
      stripe.payouts.list.mockResolvedValue(payouts);

      await expect(
        service.listPayouts('acct_1', {
          limit: 10,
          startingAfter: 'po_1',
        }),
      ).resolves.toBe(payouts);
      expect(stripe.payouts.list).toHaveBeenCalledWith(
        { limit: 10, starting_after: 'po_1' },
        { stripeAccount: 'acct_1' },
      );
    });

    it('reads the payout schedule and returns null when missing', async () => {
      const { service, stripe } = buildMocks();
      stripe.accounts.retrieve
        .mockResolvedValueOnce({
          settings: { payouts: { schedule: { interval: 'weekly' } } },
        })
        .mockRejectedValueOnce(
          new InvalidRequest('missing', 'resource_missing'),
        );

      await expect(service.getPayoutSchedule('acct_1')).resolves.toBe('weekly');
      await expect(service.getPayoutSchedule('acct_1')).resolves.toBeNull();
    });

    it('updates the payout interval', async () => {
      const { service, stripe } = buildMocks();
      const account = { id: 'acct_1' };
      stripe.accounts.update.mockResolvedValue(account);

      await expect(service.setPayoutInterval('acct_1', 'manual')).resolves.toBe(
        account,
      );
      expect(stripe.accounts.update).toHaveBeenCalledWith('acct_1', {
        settings: { payouts: { schedule: { interval: 'manual' } } },
      });
    });

    it('creates an express connected account with tenant metadata', async () => {
      const { service, stripe } = buildMocks();
      const account = { id: 'acct_new' };
      stripe.accounts.create.mockResolvedValue(account);

      await expect(
        service.createConnectedAccount('owner@test.dev', TENANT_SCHEMA),
      ).resolves.toBe(account);
      expect(stripe.accounts.create).toHaveBeenCalledWith({
        type: 'express',
        email: 'owner@test.dev',
        metadata: { tenant: TENANT_SCHEMA },
      });
    });

    it('creates an account onboarding link', async () => {
      const { service, stripe } = buildMocks();
      const link = { url: 'https://onboard' };
      stripe.accountLinks.create.mockResolvedValue(link);

      await expect(
        service.createOnboardingLink(
          'acct_1',
          'https://app.example.com/return',
          'https://app.example.com/refresh',
        ),
      ).resolves.toBe(link);
      expect(stripe.accountLinks.create).toHaveBeenCalledWith({
        account: 'acct_1',
        refresh_url: 'https://app.example.com/refresh',
        return_url: 'https://app.example.com/return',
        type: 'account_onboarding',
      });
    });
  });

  describe('connectAccount', () => {
    const request = (overrides: Record<string, unknown> = {}) =>
      ({
        tenant: tenantEntity(),
        user: { email: 'owner@test.dev' },
        headers: { origin: 'http://localhost:5174' },
        ...overrides,
      }) as unknown as RequestWithUser;

    it('forbids a request without a tenant', async () => {
      const { service } = buildMocks();

      await expect(
        service.connectAccount(request({ tenant: undefined })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('reuses an existing account and returns an onboarding link', async () => {
      const { service, stripe } = buildMocks();
      stripe.accountLinks.create.mockResolvedValue({ url: 'https://onboard' });

      await expect(service.connectAccount(request())).resolves.toEqual({
        url: 'https://onboard',
      });
      expect(stripe.accounts.create).not.toHaveBeenCalled();
      expect(stripe.accountLinks.create).toHaveBeenCalledWith({
        account: 'acct_1',
        refresh_url: 'http://localhost:5174/settings/payments',
        return_url: 'http://localhost:5174/settings/payments?stripe=return',
        type: 'account_onboarding',
      });
    });

    it('creates and persists a connected account when missing', async () => {
      const { service, stripe } = buildMocks();
      const tenant = tenantEntity({ stripeAccountId: null });
      stripe.accounts.create.mockResolvedValue({ id: 'acct_new' });
      stripe.accountLinks.create.mockResolvedValue({ url: 'https://onboard' });

      await expect(
        service.connectAccount(request({ tenant })),
      ).resolves.toEqual({ url: 'https://onboard' });
      expect(stripe.accounts.create).toHaveBeenCalledWith({
        type: 'express',
        email: 'owner@test.dev',
        metadata: { tenant: TENANT_SCHEMA },
      });
      expect(tenant.stripeAccountId).toBe('acct_new');
      expect(
        (tenant as unknown as { save: jest.Mock }).save,
      ).toHaveBeenCalled();
      expect(stripe.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'acct_new' }),
      );
    });

    it('trusts a subdomain of the root domain', async () => {
      const { service, stripe } = buildMocks();
      stripe.accountLinks.create.mockResolvedValue({ url: 'https://onboard' });

      await service.connectAccount(
        request({ headers: { origin: 'http://acme.example.com' } }),
      );

      expect(stripe.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: 'http://acme.example.com/settings/payments?stripe=return',
          refresh_url: 'http://acme.example.com/settings/payments',
        }),
      );
    });

    it('falls back to configured URLs for an untrusted origin', async () => {
      const { service, stripe } = buildMocks(
        buildConfig({
          stripe: {
            onboardingReturnUrl: 'https://app.example.com/return',
            onboardingRefreshUrl: 'https://app.example.com/refresh',
          },
        }),
      );
      stripe.accountLinks.create.mockResolvedValue({ url: 'https://onboard' });

      await service.connectAccount(
        request({ headers: { origin: 'http://evil.test' } }),
      );

      expect(stripe.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: 'https://app.example.com/return',
          refresh_url: 'https://app.example.com/refresh',
        }),
      );
    });

    it('rejects an untrusted origin when no fallback URLs are configured', async () => {
      const { service, stripe } = buildMocks();

      await expect(
        service.connectAccount(
          request({ headers: { origin: 'http://evil.test' } }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripe.accountLinks.create).not.toHaveBeenCalled();
    });
  });
});
