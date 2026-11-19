import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IENV } from 'src/common/config/env.interface';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { tenantStorage } from '../../auth/tenant-context';
import { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { OrderPermissionKey } from '../../orders/constants/order-permissions.enum';
import { Order } from '../../orders/entities/order.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../constants/payment-status.enum';
import { PaymentsProviders } from '../constants/payments-providers';
import { OrderPaymentService } from '../services/order-payment.service';
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

const InvalidRequest = (
  Stripe as unknown as {
    errors: {
      StripeInvalidRequestError: new (
        message?: string,
        code?: string,
      ) => Error & { code?: string };
    };
  }
).errors.StripeInvalidRequestError;

const TENANT = 'tenant_acme';
const META = { orderId: 1, tenant: TENANT, userId: 7 };

const stripe = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
};

const firstCallArg = (mock: jest.Mock): Record<string, unknown> => {
  const calls = mock.mock.calls as unknown as Array<[Record<string, unknown>]>;
  return calls[0][0];
};

const tenantEntity = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 3,
    schemaName: TENANT,
    stripeAccountId: 'acct_1',
    currency: 'usd',
    paymentsPaused: false,
    ...overrides,
  }) as Tenant;

const order = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 1,
    userId: 7,
    total: 25,
    paymentStatus: PaymentStatus.UNPAID,
    createdAt: new Date(),
    ...overrides,
  }) as Order;

const user = (
  overrides: Partial<RequestWithUser['user']> = {},
): RequestWithUser['user'] => ({
  id: 7,
  name: 'Customer',
  email: 'customer@test.dev',
  emailVerified: true,
  role: null,
  permissions: [],
  ...overrides,
});

const withTenant = <T>(tenant: Tenant, fn: () => T): T =>
  tenantStorage.run({ tenant, tenantSchema: tenant.schemaName }, fn);

const buildConfig = (applicationFeeBps = 0): ConfigService<IENV> =>
  ({
    getOrThrow: jest.fn((key: string) =>
      key === 'stripe' ? { applicationFeeBps } : undefined,
    ),
  }) as unknown as ConfigService<IENV>;

const buildMocks = (config = buildConfig()) => {
  const paymentRepo = {
    findOne: jest.fn(),
    save: jest.fn((data: unknown) => data),
    update: jest.fn(),
    merge: jest.fn((entity: unknown, data: unknown) => {
      Object.assign(entity as object, data as object);
      return entity;
    }),
    manager: { transaction: jest.fn() },
  };
  const orderRepo = {
    findOne: jest.fn(),
    save: jest.fn((data: unknown) => data),
    merge: jest.fn((entity: unknown, data: unknown) => {
      Object.assign(entity as object, data as object);
      return entity;
    }),
    manager: { transaction: jest.fn() },
  };
  const manager = {
    findOne: jest.fn((entity: unknown): unknown =>
      entity === Payment ? paymentRepo.findOne() : orderRepo.findOne(),
    ),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    save: jest.fn((_entity: unknown, data: unknown) => data),
    update: jest.fn(),
    withRepository: jest.fn((repo: unknown) =>
      repo === paymentRepo ? paymentRepo : orderRepo,
    ),
  };
  paymentRepo.manager.transaction.mockImplementation(
    (callback: (value: typeof manager) => unknown) => callback(manager),
  );
  orderRepo.manager.transaction.mockImplementation(
    (callback: (value: typeof manager) => unknown) => callback(manager),
  );
  const tenantManager = {
    getRepository: jest.fn((entity: unknown) =>
      Promise.resolve(entity === Payment ? paymentRepo : orderRepo),
    ),
  };
  const service = new OrderPaymentService(
    config,
    tenantManager as unknown as TenantManagerService,
    { client: stripe } as unknown as StripeClientService,
  );
  return {
    service,
    paymentRepo,
    orderRepo,
    manager,
    tenantManager,
  };
};

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  orderId: 1,
  paymentRef: 'pi_1',
  amount: 100,
  refundedAmount: 0,
  refundReference: null,
  refundedAt: null,
  paidAt: null,
  status: PaymentStatus.PENDING,
  ...overrides,
});

describe('OrderPaymentService', () => {
  beforeEach(() => {
    stripe.paymentIntents.create.mockReset();
    stripe.paymentIntents.retrieve.mockReset();
    stripe.refunds.create.mockReset();
  });

  it('resolves repositories with the tenant schema from metadata', async () => {
    const { service, tenantManager, paymentRepo, orderRepo } = buildMocks();
    paymentRepo.findOne.mockResolvedValue(payment());
    orderRepo.findOne.mockResolvedValue(order());

    await service.successOrderPayment(META, 'pi_1');

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
    const service = new OrderPaymentService({} as never, tenantManager, {
      client: {},
    } as StripeClientService);

    await expect(
      (
        service as unknown as { repos: (t?: unknown) => Promise<unknown> }
      ).repos(),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('createOrderPaymentIntent', () => {
    it('throws NotFound when the order does not exist', async () => {
      const { service, orderRepo, manager } = buildMocks();
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.findOne).toHaveBeenCalledWith(Order, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects an order older than 24 hours', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        order({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }),
      );

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects payment when the tenant has payments paused', async () => {
      const { service, orderRepo } = buildMocks();

      await expect(
        withTenant(tenantEntity({ paymentsPaused: true }), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(orderRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects payment when the store is not connected to Stripe', async () => {
      const { service, orderRepo } = buildMocks();

      await expect(
        withTenant(tenantEntity({ stripeAccountId: null }), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(orderRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects an order already marked PAID', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.PAID }),
      );

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toThrow('Order has already been paid');
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it.each([
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
    ])('reuses an existing %s intent', async (status) => {
      const { service, orderRepo, paymentRepo, manager } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order());
      paymentRepo.findOne.mockResolvedValue({ paymentRef: 'pi_existing' });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_existing',
        status,
        client_secret: 'cs_existing',
      });

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).resolves.toEqual({ clientSecret: 'cs_existing' });
      expect(manager.findOne).toHaveBeenNthCalledWith(2, Payment, {
        where: {
          order: { id: 1 },
          provider: PaymentsProviders.STRIPE,
        },
        order: { createdAt: 'DESC' },
      });
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it.each([
      ['succeeded', 'Order has already been paid'],
      [
        'canceled',
        'Previous payment attempt was canceled. A new payment attempt is required.',
      ],
    ])('rejects an existing %s intent', async (status, message) => {
      const { service, orderRepo, paymentRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order());
      paymentRepo.findOne.mockResolvedValue({ paymentRef: 'pi_existing' });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_existing',
        status,
      });

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toThrow(message);
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects a non-positive order amount', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order({ total: 0 }));

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toThrow('Invalid order amount');
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('creates a destination-charge intent and mirrors PENDING', async () => {
      const { service, orderRepo, manager } = buildMocks();
      const targetOrder = order();
      orderRepo.findOne.mockResolvedValue(targetOrder);
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_1',
        client_secret: 'cs_1',
      });

      const result = await withTenant(tenantEntity(), () =>
        service.createOrderPaymentIntent({ orderId: 1 }, user()),
      );

      expect(result).toEqual({ clientSecret: 'cs_1' });
      const params = firstCallArg(stripe.paymentIntents.create);
      expect(params).toMatchObject({
        amount: 2500,
        currency: 'usd',
        transfer_data: { destination: 'acct_1' },
        payment_method_types: ['card'],
      });
      expect((params.metadata as { data: string }).data).toBe(
        JSON.stringify({ orderId: 1, userId: 7, tenant: TENANT }),
      );
      expect(params).not.toHaveProperty('application_fee_amount');
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.anything(),
        { idempotencyKey: 'tenant:3:order:1:payment:v1' },
      );
      expect(manager.create).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({
          order: targetOrder,
          amount: 25,
          currency: 'usd',
          provider: PaymentsProviders.STRIPE,
          status: PaymentStatus.PENDING,
          paymentRef: 'pi_1',
        }),
      );
      expect(manager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({ paymentRef: 'pi_1' }),
      );
      expect(manager.update).toHaveBeenCalledWith(Order, 1, {
        paymentStatus: PaymentStatus.PENDING,
      });
      expect(orderRepo.manager.transaction).toHaveBeenCalledTimes(1);
    });

    it('adds the application fee only when it is greater than zero', async () => {
      const { service, orderRepo } = buildMocks(buildConfig(100));
      orderRepo.findOne.mockResolvedValue(order());
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_1',
        client_secret: 'cs_1',
      });

      await withTenant(tenantEntity(), () =>
        service.createOrderPaymentIntent({ orderId: 1 }, user()),
      );

      expect(firstCallArg(stripe.paymentIntents.create)).toMatchObject({
        application_fee_amount: 25,
      });
    });

    it('maps StripeInvalidRequestError to a 400', async () => {
      const { service, orderRepo, manager } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order());
      stripe.paymentIntents.create.mockRejectedValue(
        new InvalidRequest('bad', 'card_declined'),
      );

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toThrow('Store cannot accept payments right now');
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('propagates non-Stripe errors', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order());
      const boom = new Error('network down');
      stripe.paymentIntents.create.mockRejectedValue(boom);

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toBe(boom);
    });

    it('hides a non-owned order from a customer', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order({ userId: 99 }));

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user()),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('allows the order owner to create the payment intent', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order({ userId: 7 }));
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_owner',
        client_secret: 'cs_owner',
      });

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent({ orderId: 1 }, user({ id: 7 })),
        ),
      ).resolves.toEqual({ clientSecret: 'cs_owner' });
    });

    it('allows a manager to pay an order owned by another user', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order({ userId: 99 }));
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_manager',
        client_secret: 'cs_manager',
      });

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent(
            { orderId: 1 },
            user({
              id: 8,
              permissions: [OrderPermissionKey.MANAGE as never],
            }),
          ),
        ),
      ).resolves.toEqual({ clientSecret: 'cs_manager' });
    });

    it('allows a store owner to pay an order owned by another user', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order({ userId: 99 }));
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_store_owner',
        client_secret: 'cs_store_owner',
      });

      await expect(
        withTenant(tenantEntity(), () =>
          service.createOrderPaymentIntent(
            { orderId: 1 },
            user({
              id: 8,
              role: { id: 1, key: RoleKey.STORE_OWNER },
            }),
          ),
        ),
      ).resolves.toEqual({ clientSecret: 'cs_store_owner' });
    });

    it('uses different idempotency keys for the same order id in different tenants', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(order());
      stripe.paymentIntents.create
        .mockResolvedValueOnce({ id: 'pi_3', client_secret: 'cs_3' })
        .mockResolvedValueOnce({ id: 'pi_42', client_secret: 'cs_42' });

      await withTenant(tenantEntity({ id: 3 }), () =>
        service.createOrderPaymentIntent({ orderId: 1 }, user()),
      );
      await withTenant(tenantEntity({ id: 42 }), () =>
        service.createOrderPaymentIntent({ orderId: 1 }, user()),
      );

      expect(stripe.paymentIntents.create).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        { idempotencyKey: 'tenant:3:order:1:payment:v1' },
      );
      expect(stripe.paymentIntents.create).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        { idempotencyKey: 'tenant:42:order:1:payment:v1' },
      );
    });
  });

  describe('refundOrder', () => {
    it('returns null when there is no paid payment', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refundOrder(order(), { schemaName: TENANT }),
      ).resolves.toBeNull();
      expect(paymentRepo.findOne).toHaveBeenCalledWith({
        where: { orderId: 1, status: PaymentStatus.PAID },
        order: { id: 'DESC' },
      });
      expect(stripe.refunds.create).not.toHaveBeenCalled();
    });

    it('rejects a paid payment without a payment reference', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue({ id: 5, paymentRef: null });

      await expect(
        service.refundOrder(order(), { schemaName: TENANT }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(paymentRepo.update).not.toHaveBeenCalled();
    });

    it('creates an idempotent reverse-transfer refund and marks the payment REFUNDED', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue({
        id: 5,
        paymentRef: 'pi_1',
        amount: 25,
      });
      stripe.refunds.create.mockResolvedValue({ id: 're_1' });

      const result = await service.refundOrder(order(), {
        schemaName: TENANT,
      });

      expect(stripe.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_1',
          reverse_transfer: true,
          refund_application_fee: true,
        },
        { idempotencyKey: 'refund-5' },
      );
      expect(paymentRepo.update).toHaveBeenCalledWith(
        { id: 5 },
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundedAmount: 25,
          refundReference: 're_1',
          refundedAt: expect.any(Date) as Date,
        }),
      );
      expect(result?.refundedAt).toBeInstanceOf(Date);
    });

    it('maps StripeInvalidRequestError to a 400 without updating the payment', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue({ id: 5, paymentRef: 'pi_1' });
      stripe.refunds.create.mockRejectedValue(new InvalidRequest('nope'));

      await expect(
        service.refundOrder(order(), { schemaName: TENANT }),
      ).rejects.toThrow('Refund could not be processed');
      expect(paymentRepo.update).not.toHaveBeenCalled();
    });

    it('propagates non-Stripe errors without updating the payment', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue({ id: 5, paymentRef: 'pi_1' });
      const boom = new Error('network');
      stripe.refunds.create.mockRejectedValue(boom);

      await expect(
        service.refundOrder(order(), { schemaName: TENANT }),
      ).rejects.toBe(boom);
      expect(paymentRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('successPayment', () => {
    it('marks both payment and order PAID with timestamps', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      const p = payment();
      const o = order();
      paymentRepo.findOne.mockResolvedValue(p);
      orderRepo.findOne.mockResolvedValue(o);

      await service.successOrderPayment(META, 'pi_1');

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
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('throws NotFound when the payment is missing', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.successOrderPayment(META, 'pi_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the order is missing or foreign', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.successOrderPayment(META, 'pi_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('repairs paid timestamps without overwriting refund status', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.REFUNDED, paidAt: null }),
      );
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.REFUNDED, paidAt: null }),
      );

      await service.successOrderPayment(META, 'pi_1');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          paidAt: expect.any(Date) as Date,
        }),
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentStatus: PaymentStatus.REFUNDED,
          paidAt: expect.any(Date) as Date,
        }),
      );
    });
  });

  describe('canceledPayment', () => {
    it('marks the payment CANCELED and resets the order to UNPAID', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(order());

      await service.cancelOrderPayment(META, 'pi_1');

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
        service.cancelOrderPayment(META, 'pi_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the order is missing or foreign', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.cancelOrderPayment(META, 'pi_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('does not let a late cancel overwrite a PAID payment', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.PAID }),
      );
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.PAID }),
      );

      await service.cancelOrderPayment(META, 'pi_1');

      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('failedPayment', () => {
    it('marks both payment and order FAILED', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(order());

      await service.failedOrderPayment(META, 'pi_1');

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

      await expect(
        service.failedOrderPayment(META, 'pi_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the order is missing or foreign', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(payment());
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.failedOrderPayment(META, 'pi_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('does not let a late failure overwrite a PAID payment', async () => {
      const { service, paymentRepo, orderRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.PAID }),
      );
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.PAID }),
      );

      await service.failedOrderPayment(META, 'pi_1');

      expect(paymentRepo.save).not.toHaveBeenCalled();
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
      await mocks.service.refundedOrderPayment(
        META,
        refund({ amountRefunded }),
      );
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

      await mocks.service.refundedOrderPayment(
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
        service.refundedOrderPayment(META, refund({ amountRefunded: 50 })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the order is missing or foreign', async () => {
      const mocks = buildMocks();
      mocks.paymentRepo.findOne.mockResolvedValue(payment({ amount: 1 }));
      mocks.orderRepo.findOne.mockResolvedValue(null);

      await expect(
        mocks.service.refundedOrderPayment(
          META,
          refund({ amountRefunded: 50 }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mocks.orderRepo.save).not.toHaveBeenCalled();
    });
  });
});
