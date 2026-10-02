import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantService } from '../tenants/tenant.service';
import { OrderStatus } from '../orders/constants/order-status.enum';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import { tenantStorage } from '../auth/tenant-context';
import StripePaymentService from '../payments/stripe.payment.service';

const TENANT = { schemaName: 'tenant_test' };

const buildMocks = () => {
  const userQb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
  };

  const orderRepo = {
    count: jest.fn(),
  };
  const userRepo = {
    createQueryBuilder: jest.fn(() => userQb),
  };

  const tenantManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Order) return Promise.resolve(orderRepo);
      if (entity === User) return Promise.resolve(userRepo);
      return Promise.resolve(orderRepo);
    }),
  } as unknown as TenantManagerService;

  const findBySchemaName = jest.fn().mockResolvedValue({
    stripeAccountId: 'acct_123',
    storageUsedBytes: 200n,
    storageCapacityBytes: 1000n,
  });
  const tenantService = { findBySchemaName } as unknown as TenantService;

  const getBalance = jest.fn().mockResolvedValue({
    available: [{ amount: 12345, currency: 'usd' }],
    pending: [{ amount: 1000, currency: 'usd' }],
  });
  const stripePaymentService = {
    getBalance,
  } as unknown as StripePaymentService;

  const service = new DashboardService(
    tenantManager,
    tenantService,
    stripePaymentService,
  );

  return {
    service,
    tenantManager,
    tenantService,
    findBySchemaName,
    orderRepo,
    userRepo,
    userQb,
    getBalance,
  };
};

const countsByStatus = (options?: {
  where?: { status?: OrderStatus };
}): Promise<number> => {
  const status = options?.where?.status;
  if (status === OrderStatus.DELIVERED) return Promise.resolve(3);
  if (status === OrderStatus.PENDING) return Promise.resolve(2);
  return Promise.resolve(10);
};

describe('DashboardService', () => {
  it('requires a tenant context', async () => {
    const { service } = buildMocks();

    await expect(service.getStats()).rejects.toThrow(ForbiddenException);
  });

  it('aggregates counts and the Stripe balance for the tenant schema', async () => {
    const { service, orderRepo, userQb, getBalance } = buildMocks();
    orderRepo.count.mockImplementation(countsByStatus);
    userQb.getCount.mockResolvedValue(4);

    const stats = await service.getStats(TENANT);

    expect(getBalance).toHaveBeenCalledWith('acct_123');
    expect(stats).toEqual({
      totalOrders: 10,
      fulfilledOrders: 3,
      pendingOrders: 2,
      totalPaid: 123.45,
      waitingAmount: 10,
      customers: 4,
      storageUsedBytes: 200,
      storageCapacityBytes: 1000,
    });
  });

  it('queries counts by status and customers by the CUSTOMER role', async () => {
    const { service, orderRepo, userQb } = buildMocks();
    orderRepo.count.mockImplementation(countsByStatus);
    userQb.getCount.mockResolvedValue(0);

    await service.getStats(TENANT);

    expect(orderRepo.count).toHaveBeenCalledWith({
      where: { status: OrderStatus.DELIVERED },
    });
    expect(orderRepo.count).toHaveBeenCalledWith({
      where: { status: OrderStatus.PENDING },
    });
    expect(userQb.innerJoin).toHaveBeenCalledWith('u.role', 'role');
    expect(userQb.where).toHaveBeenCalledWith('role.key = :key', {
      key: RoleKey.CUSTOMER,
    });
  });

  it('sums every balance entry and converts cents to dollars', async () => {
    const { service, orderRepo, userQb, getBalance } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);
    getBalance.mockResolvedValue({
      available: [
        { amount: 1000, currency: 'usd' },
        { amount: 250, currency: 'usd' },
      ],
      pending: [{ amount: 99, currency: 'usd' }],
    });

    const stats = await service.getStats(TENANT);

    expect(stats.totalPaid).toBe(12.5);
    expect(stats.waitingAmount).toBe(0.99);
  });

  it('skips Stripe and returns zero money when the store has no account', async () => {
    const { service, orderRepo, userQb, getBalance, findBySchemaName } =
      buildMocks();
    findBySchemaName.mockResolvedValue({
      stripeAccountId: null,
      storageUsedBytes: 0n,
      storageCapacityBytes: 0n,
    });
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);

    const stats = await service.getStats(TENANT);

    expect(getBalance).not.toHaveBeenCalled();
    expect(stats.totalPaid).toBe(0);
    expect(stats.waitingAmount).toBe(0);
  });

  it('falls back to zero money when Stripe is unavailable', async () => {
    const { service, orderRepo, userQb, getBalance } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);
    getBalance.mockRejectedValue(new Error('stripe down'));

    const stats = await service.getStats(TENANT);

    expect(stats.totalPaid).toBe(0);
    expect(stats.waitingAmount).toBe(0);
  });

  it('returns zero money when the connected account is empty', async () => {
    const { service, orderRepo, userQb, getBalance } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);
    getBalance.mockResolvedValue(null);

    const stats = await service.getStats(TENANT);

    expect(stats.totalPaid).toBe(0);
    expect(stats.waitingAmount).toBe(0);
  });

  it('falls back to zero storage when the tenant row is missing', async () => {
    const { service, findBySchemaName, orderRepo, userQb, getBalance } =
      buildMocks();
    findBySchemaName.mockResolvedValue(null);
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);

    const stats = await service.getStats(TENANT);

    expect(getBalance).not.toHaveBeenCalled();
    expect(stats.storageUsedBytes).toBe(0);
    expect(stats.storageCapacityBytes).toBe(0);
  });

  it('resolves the tenant from AsyncLocalStorage when no arg is passed', async () => {
    const { service, orderRepo, userQb } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);

    const stats = await tenantStorage.run(
      { tenant: {} as never, tenantSchema: 'tenant_ctx' },
      () => service.getStats(),
    );

    expect(stats.totalOrders).toBe(0);
  });

  it('degrades gracefully when Stripe rejects with a non-Error', async () => {
    const { service, orderRepo, userQb, getBalance } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);
    getBalance.mockRejectedValue('stripe exploded');

    const stats = await service.getStats(TENANT);

    expect(stats.totalPaid).toBe(0);
    expect(stats.waitingAmount).toBe(0);
  });

  it('returns zero money when the balance payload has no entry arrays', async () => {
    const { service, orderRepo, userQb, getBalance } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);
    getBalance.mockResolvedValue({ available: undefined, pending: [] });

    const stats = await service.getStats(TENANT);

    expect(stats.totalPaid).toBe(0);
    expect(stats.waitingAmount).toBe(0);
  });

  it('returns zero money when both balance lists are empty', async () => {
    const { service, orderRepo, userQb, getBalance } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);
    getBalance.mockResolvedValue({ available: [], pending: [] });

    const stats = await service.getStats(TENANT);

    expect(stats.totalPaid).toBe(0);
    expect(stats.waitingAmount).toBe(0);
  });

  it('sums multiple pending entries as well as available ones', async () => {
    const { service, orderRepo, userQb, getBalance } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);
    getBalance.mockResolvedValue({
      available: [{ amount: 500, currency: 'usd' }],
      pending: [
        { amount: 250, currency: 'usd' },
        { amount: 2500, currency: 'usd' },
      ],
    });

    const stats = await service.getStats(TENANT);

    expect(stats.totalPaid).toBe(5);
    expect(stats.waitingAmount).toBe(27.5);
  });

  it('coerces null storage counters to zero', async () => {
    const { service, findBySchemaName, orderRepo, userQb } = buildMocks();
    findBySchemaName.mockResolvedValue({
      stripeAccountId: null,
      storageUsedBytes: null,
      storageCapacityBytes: null,
    });
    orderRepo.count.mockResolvedValue(0);
    userQb.getCount.mockResolvedValue(0);

    const stats = await service.getStats(TENANT);

    expect(stats.storageUsedBytes).toBe(0);
    expect(stats.storageCapacityBytes).toBe(0);
  });
});
