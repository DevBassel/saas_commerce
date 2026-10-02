import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { Order } from '../orders/entities/order.entity';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from './constants/payment-status.enum';
import PaymentService from './payments.service';

const TENANT = 'tenant_acme';
const META = { orderId: 1, tenant: TENANT, userId: 7 };

const buildMocks = () => {
  const paymentRepo = {
    findOne: jest.fn(),
    save: jest.fn((data: unknown) => data),
  };
  const orderRepo = {
    findOne: jest.fn(),
    save: jest.fn((data: unknown) => data),
  };
  const tenantManager = {
    getRepository: jest.fn((entity: unknown) =>
      Promise.resolve(entity === Payment ? paymentRepo : orderRepo),
    ),
  };

  const service = new PaymentService(
    tenantManager as unknown as TenantManagerService,
  );
  return { service, paymentRepo, orderRepo, tenantManager };
};

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  orderId: 1,
  paymentRef: 'pi_1',
  amount: 100,
  refundedAmount: 0,
  refundReference: null,
  refundedAt: null,
  status: PaymentStatus.PENDING,
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 7,
  paymentStatus: PaymentStatus.UNPAID,
  ...overrides,
});

describe('PaymentService', () => {
  it('resolves repositories with the tenant schema from metadata', async () => {
    const { service, tenantManager, paymentRepo, orderRepo } = buildMocks();
    paymentRepo.findOne.mockResolvedValue(payment());
    orderRepo.findOne.mockResolvedValue(order());

    await service.successPayment(META, 'pi_1');

    expect(tenantManager.getRepository).toHaveBeenCalledWith(Payment, {
      schemaName: TENANT,
    });
    expect(tenantManager.getRepository).toHaveBeenCalledWith(Order, {
      schemaName: TENANT,
    });
  });

  it('forbids a call without tenant scope', async () => {
    const tenantManager = {
      getRepository: jest.fn(),
    } as unknown as TenantManagerService;
    const service = new PaymentService(tenantManager);

    await expect(
      (
        service as unknown as { repos: (t?: unknown) => Promise<unknown> }
      ).repos(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('successPayment', () => {
    it('marks both payment and order PAID with timestamps', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      const p = payment();
      const o = order();
      paymentRepo.findOne.mockResolvedValue(p);
      orderRepo.findOne.mockResolvedValue(o);

      await service.successPayment(META, 'pi_1');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          status: PaymentStatus.PAID,
          paidAt: expect.any(Date) as Date,
        }),
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          paymentStatus: PaymentStatus.PAID,
          paidAt: expect.any(Date) as Date,
        }),
      );
      expect(orderRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 7 },
      });
    });

    it('throws NotFound when the payment is missing', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.successPayment(META, 'pi_1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when the order is missing or foreign', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.successPayment(META, 'pi_1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('canceledPayment', () => {
    it('marks the payment CANCELED and resets the order to UNPAID', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(order());

      await service.canceledPayment(META, 'pi_1');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.CANCELED,
          canceledAt: expect.any(Date) as Date,
        }),
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: PaymentStatus.UNPAID,
          canceledAt: expect.any(Date) as Date,
        }),
      );
    });

    it('throws NotFound when the payment is missing', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.canceledPayment(META, 'pi_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the order is missing or foreign', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.canceledPayment(META, 'pi_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('failedPayment', () => {
    it('marks both payment and order FAILED', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(order());

      await service.failedPayment(META, 'pi_1');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.FAILED,
          failedAt: expect.any(Date) as Date,
        }),
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: PaymentStatus.FAILED,
          failedAt: expect.any(Date) as Date,
        }),
      );
    });

    it('throws NotFound when the payment is missing', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.failedPayment(META, 'pi_1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when the order is missing or foreign', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.failedPayment(META, 'pi_1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('refundedPayment status derivation', () => {
    const refund = (overrides: Record<string, unknown> = {}) => ({
      paymentIntentId: 'pi_1',
      amountRefunded: 0,
      refundReference: null,
      ...overrides,
    });

    const run = async (amountRefunded: number, paymentOverrides = {}) => {
      const mocks = buildMocks();
      mocks.paymentRepo.findOne.mockResolvedValue(
        payment({ amount: 1, ...paymentOverrides }),
      );
      mocks.orderRepo.findOne.mockResolvedValue(order());
      await mocks.service.refundedPayment(META, refund({ amountRefunded }));
      return mocks;
    };

    it.each([
      [0, PaymentStatus.PAID],
      [50, PaymentStatus.PARTIALLY_REFUNDED],
      [100, PaymentStatus.REFUNDED],
      [150, PaymentStatus.REFUNDED],
    ])('amountRefunded %i cents -> %s', async (amountRefunded, expected) => {
      const { paymentRepo, orderRepo } = await run(amountRefunded);

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: expected }),
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: expected }),
      );
    });

    it('clears refundedAt and refundReference when nothing is refunded', async () => {
      const { paymentRepo } = await run(0, {
        refundedAt: new Date('2026-01-01T00:00:00Z'),
        refundReference: 're_old',
      });

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.PAID,
          refundedAt: null,
          refundReference: null,
        }),
      );
    });

    it('preserves a previously stored refundedAt across repeats', async () => {
      const original = new Date('2026-01-01T00:00:00Z');
      const { paymentRepo } = await run(50, { refundedAt: original });

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ refundedAt: original }),
      );
    });

    it('keeps the stored refundReference when a later callback omits it', async () => {
      const { paymentRepo } = await run(50, { refundReference: 're_kept' });

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ refundReference: 're_kept' }),
      );
    });

    it('prefers the refundReference from the callback when present', async () => {
      const mocks = buildMocks();
      mocks.paymentRepo.findOne.mockResolvedValue(
        payment({ amount: 100, refundReference: 're_old' }),
      );
      mocks.orderRepo.findOne.mockResolvedValue(order());

      await mocks.service.refundedPayment(
        META,
        refund({ amountRefunded: 50, refundReference: 're_new' }),
      );

      expect(mocks.paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ refundReference: 're_new' }),
      );
    });

    it('throws NotFound when the payment is missing', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refundedPayment(META, refund({ amountRefunded: 50 })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the order is missing or foreign', async () => {
      const mocks = buildMocks();
      mocks.paymentRepo.findOne.mockResolvedValue(payment({ amount: 1 }));
      mocks.orderRepo.findOne.mockResolvedValue(null);

      await expect(
        mocks.service.refundedPayment(META, refund({ amountRefunded: 50 })),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mocks.orderRepo.save).not.toHaveBeenCalled();
    });
  });
});
