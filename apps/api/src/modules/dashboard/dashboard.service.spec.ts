import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { OrderStatus } from '../orders/constants/order-status.enum';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import { tenantStorage } from '../auth/tenant-context';

const TENANT = { schemaName: 'tenant_test' };

const buildMocks = () => {
  const orderQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const userQb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
  };

  const orderRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => orderQb),
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

  const service = new DashboardService(tenantManager);

  return { service, tenantManager, orderRepo, userRepo, orderQb, userQb };
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

  it('aggregates counts, money and customers for the tenant schema', async () => {
    const { service, orderRepo, orderQb, userQb } = buildMocks();
    orderRepo.count.mockImplementation(countsByStatus);
    orderQb.getRawOne.mockResolvedValue({ paid: '123.456', waiting: '10' });
    userQb.getCount.mockResolvedValue(4);

    const stats = await service.getStats(TENANT);

    expect(stats).toEqual({
      totalOrders: 10,
      fulfilledOrders: 3,
      pendingOrders: 2,
      totalPaid: 123.46,
      waitingAmount: 10,
      customers: 4,
    });
  });

  it('queries money by PAID/UNPAID and customers by the CUSTOMER role', async () => {
    const { service, orderRepo, orderQb, userQb } = buildMocks();
    orderRepo.count.mockImplementation(countsByStatus);
    orderQb.getRawOne.mockResolvedValue({ paid: '0', waiting: '0' });
    userQb.getCount.mockResolvedValue(0);

    await service.getStats(TENANT);

    expect(orderRepo.count).toHaveBeenCalledWith({
      where: { status: OrderStatus.DELIVERED },
    });
    expect(orderRepo.count).toHaveBeenCalledWith({
      where: { status: OrderStatus.PENDING },
    });
    expect(orderQb.setParameters).toHaveBeenCalledWith({
      paid: PaymentStatus.PAID,
      unpaid: PaymentStatus.UNPAID,
    });
    expect(userQb.innerJoin).toHaveBeenCalledWith('u.role', 'role');
    expect(userQb.where).toHaveBeenCalledWith('role.key = :key', {
      key: RoleKey.CUSTOMER,
    });
  });

  it('returns zeroed money when the store has no orders', async () => {
    const { service, orderRepo, orderQb, userQb } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    orderQb.getRawOne.mockResolvedValue({ paid: null, waiting: null });
    userQb.getCount.mockResolvedValue(0);

    const stats = await service.getStats(TENANT);

    expect(stats).toEqual({
      totalOrders: 0,
      fulfilledOrders: 0,
      pendingOrders: 0,
      totalPaid: 0,
      waitingAmount: 0,
      customers: 0,
    });
  });

  it('resolves the tenant from AsyncLocalStorage when no arg is passed', async () => {
    const { service, orderRepo, orderQb, userQb } = buildMocks();
    orderRepo.count.mockResolvedValue(0);
    orderQb.getRawOne.mockResolvedValue({ paid: '0', waiting: '0' });
    userQb.getCount.mockResolvedValue(0);

    const stats = await tenantStorage.run(
      { tenant: {} as never, tenantSchema: 'tenant_ctx' },
      () => service.getStats(),
    );

    expect(stats.totalOrders).toBe(0);
  });
});
