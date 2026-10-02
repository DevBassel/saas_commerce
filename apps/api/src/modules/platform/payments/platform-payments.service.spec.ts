import { ConflictException } from '@nestjs/common';
import { PlatformPaymentsService } from './platform-payments.service';
import { TenantService } from '../../tenants/tenant.service';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import StripePaymentService from '../../payments/stripe.payment.service';
import { Payment } from '../../payments/entities/payment.entity';
import { TenantStatus } from '../../tenants/enums/tenantStatus.enum';

type StripeMock = {
  getPlatformAccountStatus: jest.Mock;
  getPlatformBalance: jest.Mock;
  getAccountStatus: jest.Mock;
  getBalance: jest.Mock;
  getPayoutSchedule: jest.Mock;
  setPayoutInterval: jest.Mock;
  listPayouts: jest.Mock;
};

const tenant = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Acme',
  slug: 'acme',
  subdomain: 'acme',
  status: TenantStatus.ACTIVE,
  schemaName: 'tenant_acme',
  stripeAccountId: 'acct_1',
  paymentsPaused: false,
  payoutsPaused: false,
  stripePayoutsInterval: null,
  ...overrides,
});

const buildMocks = () => {
  const stripePaymentService: StripeMock = {
    getPlatformAccountStatus: jest.fn(),
    getPlatformBalance: jest.fn(),
    getAccountStatus: jest.fn(),
    getBalance: jest.fn(),
    getPayoutSchedule: jest.fn(),
    setPayoutInterval: jest.fn().mockResolvedValue(undefined),
    listPayouts: jest.fn(),
  };
  const tenantService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    updatePaymentControls: jest.fn().mockResolvedValue(undefined),
  };
  const paymentRepo = { findAndCount: jest.fn() };
  const tenantManager = {
    getRepository: jest.fn(() => Promise.resolve(paymentRepo)),
  };

  const service = new PlatformPaymentsService(
    tenantService as unknown as TenantService,
    tenantManager as unknown as TenantManagerService,
    stripePaymentService as unknown as StripePaymentService,
  );

  return {
    service,
    tenantService,
    paymentRepo,
    tenantManager,
    stripePaymentService,
  };
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

    const summary = await service.getSummary();
    expect(summary.account).toEqual(
      expect.objectContaining({ accountId: 'acct_platform' }),
    );
    expect(summary.balance).toEqual({
      available: [{ amount: 12345, currency: 'usd' }],
      pending: [],
    });
    expect(summary.error).toBeNull();
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

describe('PlatformPaymentsService tenant views', () => {
  it('lists tenants with only the payment-relevant fields', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findAll.mockResolvedValue([tenant()]);

    await expect(service.listTenants()).resolves.toEqual([
      {
        id: 1,
        name: 'Acme',
        slug: 'acme',
        subdomain: 'acme',
        status: TenantStatus.ACTIVE,
        stripeAccountId: 'acct_1',
        paymentsPaused: false,
        payoutsPaused: false,
      },
    ]);
  });

  it('returns connected account balances and schedule in the overview', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant());
    stripePaymentService.getAccountStatus.mockResolvedValue({
      connected: true,
      accountId: 'acct_1',
    });
    stripePaymentService.getBalance.mockResolvedValue({
      available: [],
      pending: [],
    });
    stripePaymentService.getPayoutSchedule.mockResolvedValue('weekly');

    const result = await service.getOverview(1);

    expect(result.account).toEqual({ connected: true, accountId: 'acct_1' });
    expect(result.balance).toEqual({ available: [], pending: [] });
    expect(result.payoutScheduleInterval).toBe('weekly');
    expect(stripePaymentService.getBalance).toHaveBeenCalledWith('acct_1');
  });

  it('skips balance lookups when the account is not connected', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant({ stripeAccountId: null }));
    stripePaymentService.getAccountStatus.mockResolvedValue({
      connected: false,
      accountId: null,
    });

    const result = await service.getOverview(1);

    expect(result.balance).toBeNull();
    expect(result.payoutScheduleInterval).toBeNull();
    expect(stripePaymentService.getBalance).not.toHaveBeenCalled();
  });

  it('lists charges with clamping, pagination and order mapping', async () => {
    const { service, tenantService, paymentRepo, tenantManager } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant());
    paymentRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 5,
          orderId: 1,
          order: { orderNumber: 'ORD-1' },
          amount: 25,
          currency: 'usd',
          status: 'PAID',
          paymentRef: 'pi_1',
          refundedAmount: 0,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          paidAt: new Date('2026-01-01T01:00:00Z'),
          refundedAt: null,
        },
      ],
      9,
    ]);

    const result = await service.listCharges(1, 0, 1000);

    expect(tenantManager.getRepository).toHaveBeenCalledWith(Payment, {
      schemaName: 'tenant_acme',
    });
    expect(paymentRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
    expect(result.total).toBe(9);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 5,
        orderId: 1,
        orderNumber: 'ORD-1',
        amount: 25,
        status: 'PAID',
        paymentRef: 'pi_1',
      }),
    );
  });

  it('defaults a non-finite limit and flips null order numbers', async () => {
    const { service, tenantService, paymentRepo } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant());
    paymentRepo.findAndCount.mockResolvedValue([
      [{ id: 5, order: null, amount: 0, createdAt: new Date() }],
      0,
    ]);

    const result = await service.listCharges(1, 1, Number.NaN);

    expect(result.limit).toBe(25);
    expect(result.data[0].orderNumber).toBeNull();
    expect(paymentRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 25 }),
    );
  });

  it('rejects payouts when the store is not connected', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant({ stripeAccountId: null }));

    await expect(service.listPayouts(1, 10)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lists payouts and exposes the next cursor', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant());
    stripePaymentService.listPayouts.mockResolvedValue({
      data: [
        {
          id: 'po_1',
          amount: 100,
          currency: 'usd',
          status: 'paid',
          method: 'standard',
          arrival_date: 1,
          created: 2,
          description: null,
        },
        {
          id: 'po_2',
          amount: 50,
          currency: 'usd',
          status: 'pending',
          method: 'standard',
          arrival_date: 3,
          created: 4,
          description: 'payout',
        },
      ],
      has_more: true,
    });

    const result = await service.listPayouts(1, 10, 'po_0');

    expect(stripePaymentService.listPayouts).toHaveBeenCalledWith('acct_1', {
      limit: 10,
      startingAfter: 'po_0',
    });
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('po_2');
    expect(result.data).toHaveLength(2);
  });

  it('returns a null cursor when there is no next page', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant());
    stripePaymentService.listPayouts.mockResolvedValue({
      data: [
        {
          id: 'po_1',
          amount: 100,
          currency: 'usd',
          status: 'paid',
          method: 'standard',
          arrival_date: 1,
          created: 2,
          description: null,
        },
      ],
      has_more: false,
    });

    const result = await service.listPayouts(1, 10);

    expect(result.nextCursor).toBeNull();
  });

  it('updates paymentsPaused only when the value changes', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant({ paymentsPaused: false }));

    await expect(service.setPaymentsPaused(1, true)).resolves.toEqual({
      paymentsPaused: true,
      payoutsPaused: false,
    });
    expect(tenantService.updatePaymentControls).toHaveBeenCalledWith(1, {
      paymentsPaused: true,
    });

    jest.clearAllMocks();
    tenantService.findById.mockResolvedValue(tenant({ paymentsPaused: true }));
    await service.setPaymentsPaused(1, true);
    expect(tenantService.updatePaymentControls).not.toHaveBeenCalled();
  });

  it('rejects payout toggles when the store is not connected', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant({ stripeAccountId: null }));

    await expect(service.setPayoutsPaused(1, true)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('pauses payouts by storing the current schedule', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant());
    stripePaymentService.getPayoutSchedule.mockResolvedValue('weekly');

    await expect(service.setPayoutsPaused(1, true)).resolves.toEqual({
      paymentsPaused: false,
      payoutsPaused: true,
    });

    expect(stripePaymentService.setPayoutInterval).toHaveBeenCalledWith(
      'acct_1',
      'manual',
    );
    expect(tenantService.updatePaymentControls).toHaveBeenCalledWith(1, {
      payoutsPaused: true,
      stripePayoutsInterval: 'weekly',
    });
  });

  it('keeps the stored interval when the live schedule is already manual', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(
      tenant({ stripePayoutsInterval: 'monthly' }),
    );
    stripePaymentService.getPayoutSchedule.mockResolvedValue('manual');

    await service.setPayoutsPaused(1, true);

    expect(tenantService.updatePaymentControls).toHaveBeenCalledWith(1, {
      payoutsPaused: true,
      stripePayoutsInterval: 'monthly',
    });
  });

  it('is a no-op when payouts are already paused', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant({ payoutsPaused: true }));

    await expect(service.setPayoutsPaused(1, true)).resolves.toEqual({
      paymentsPaused: false,
      payoutsPaused: true,
    });
    expect(stripePaymentService.setPayoutInterval).not.toHaveBeenCalled();
  });

  it('is a no-op when payouts are already active', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(tenant({ payoutsPaused: false }));

    await expect(service.setPayoutsPaused(1, false)).resolves.toEqual({
      paymentsPaused: false,
      payoutsPaused: false,
    });
    expect(stripePaymentService.setPayoutInterval).not.toHaveBeenCalled();
  });

  it('resumes payouts with the stored interval, defaulting to daily', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(
      tenant({ payoutsPaused: true, stripePayoutsInterval: 'weekly' }),
    );

    await expect(service.setPayoutsPaused(1, false)).resolves.toEqual({
      paymentsPaused: false,
      payoutsPaused: false,
    });
    expect(stripePaymentService.setPayoutInterval).toHaveBeenCalledWith(
      'acct_1',
      'weekly',
    );
    expect(tenantService.updatePaymentControls).toHaveBeenCalledWith(1, {
      payoutsPaused: false,
      stripePayoutsInterval: null,
    });
  });

  it('defaults the resumed interval to daily when none is stored', async () => {
    const { service, tenantService, stripePaymentService } = buildMocks();
    tenantService.findById.mockResolvedValue(
      tenant({ payoutsPaused: true, stripePayoutsInterval: null }),
    );

    await service.setPayoutsPaused(1, false);

    expect(stripePaymentService.setPayoutInterval).toHaveBeenCalledWith(
      'acct_1',
      'daily',
    );
  });
});
