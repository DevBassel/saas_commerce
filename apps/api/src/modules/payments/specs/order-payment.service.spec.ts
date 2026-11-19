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
import { OrderStatus } from '../../orders/constants/order-status.enum';
import { Product } from '../../products/entities/product.entity';
import { Payment } from '../entities/payment.entity';
import { OrderRefund } from '../entities/order-refund.entity';
import { PaymentStatus } from '../constants/payment-status.enum';
import { RefundStatus } from '../constants/refund-status.enum';
import { PaymentsProviders } from '../constants/payments-providers';
import { OrderPaymentService } from '../stripe/services/order/order-payment.service';
import { StripeClientService } from '../stripe/stripe-client.service';
import { OrderPaymentStatusService } from '../stripe/services/order/order-payment-status.service';
import { OrderPaymentIntentService } from '../stripe/services/order/order-payment-intent.service';
import { OrderRefundService } from '../stripe/services/order/order-refund.service';

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
    retrieve: jest.fn(),
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
    status: OrderStatus.CONFIRMED,
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
    findOneBy: jest.fn(),
    save: jest.fn((data: unknown) => data),
    update: jest.fn(),
    merge: jest.fn((entity: unknown, data: unknown) => {
      Object.assign(entity as object, data as object);
      return entity;
    }),
    manager: { transaction: jest.fn() },
  };
  const refundRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => ({ id: 9, ...(data as object) })),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const productRepo = { increment: jest.fn() };
  const orderRepo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
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
      repo === paymentRepo
        ? paymentRepo
        : repo === refundRepo
          ? refundRepo
          : orderRepo,
    ),
    getRepository: jest.fn((entity: unknown) =>
      entity === Payment
        ? paymentRepo
        : entity === OrderRefund
          ? refundRepo
          : entity === Product
            ? productRepo
            : orderRepo,
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
      Promise.resolve(
        entity === Payment
          ? paymentRepo
          : entity === OrderRefund
            ? refundRepo
            : orderRepo,
      ),
    ),
  };
  const cache = { invalidateProducts: jest.fn() };
  const stripeClient = { client: stripe } as unknown as StripeClientService;
  const service = new OrderPaymentService(
    tenantManager as unknown as TenantManagerService,
    new OrderPaymentIntentService(config, stripeClient),
    new OrderPaymentStatusService(),
    new OrderRefundService(
      tenantManager as unknown as TenantManagerService,
      stripeClient,
      cache as never,
    ),
  );
  return {
    service,
    paymentRepo,
    orderRepo,
    refundRepo,
    productRepo,
    manager,
    tenantManager,
    cache,
  };
};

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  orderId: 1,
  paymentRef: 'pi_1',
  amount: 100,
  currency: 'usd',
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
    stripe.refunds.retrieve.mockReset();
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
    const service = new OrderPaymentService(
      tenantManager,
      new OrderPaymentIntentService(
        {} as never,
        { client: {} } as StripeClientService,
      ),
      new OrderPaymentStatusService(),
      new OrderRefundService(
        tenantManager,
        { client: {} } as StripeClientService,
        { invalidateProducts: jest.fn() } as never,
      ),
    );

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
        service.refundOrder(
          order({ paymentStatus: PaymentStatus.PAID }),
          OrderStatus.CANCELLED,
          { schemaName: TENANT },
        ),
      ).resolves.toBeNull();
      expect(stripe.refunds.create).not.toHaveBeenCalled();
    });

    it('rejects a paid payment without a payment reference', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(
        payment({ id: 5, paymentRef: null, status: PaymentStatus.PAID }),
      );

      await expect(
        service.refundOrder(
          order({ paymentStatus: PaymentStatus.PAID }),
          OrderStatus.CANCELLED,
          { schemaName: TENANT },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(paymentRepo.update).not.toHaveBeenCalled();
    });

    it('returns an existing successful refund without another Stripe call', async () => {
      const { service, paymentRepo, orderRepo, refundRepo } = buildMocks();
      const completedAt = new Date('2026-01-01T00:00:00Z');
      paymentRepo.findOne.mockResolvedValue(
        payment({ id: 5, status: PaymentStatus.REFUND_PENDING }),
      );
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.REFUND_PENDING }),
      );
      refundRepo.findOne.mockResolvedValue({
        id: 9,
        paymentId: 5,
        status: RefundStatus.SUCCEEDED,
        completedAt,
      });

      await expect(
        service.refundOrder(order(), OrderStatus.CANCELLED, {
          schemaName: TENANT,
        }),
      ).resolves.toEqual({
        refundStatus: RefundStatus.SUCCEEDED,
        refundedAt: completedAt,
      });
      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(stripe.refunds.retrieve).not.toHaveBeenCalled();
    });

    it('rejects an existing failed refund without another Stripe call', async () => {
      const { service, paymentRepo, orderRepo, refundRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(
        payment({ id: 5, status: PaymentStatus.REFUND_PENDING }),
      );
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.REFUND_PENDING }),
      );
      refundRepo.findOne.mockResolvedValue({
        id: 9,
        paymentId: 5,
        status: RefundStatus.FAILED,
      });

      await expect(
        service.refundOrder(order(), OrderStatus.CANCELLED, {
          schemaName: TENANT,
        }),
      ).rejects.toThrow('Refund could not be processed');
      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(stripe.refunds.retrieve).not.toHaveBeenCalled();
    });

    it('persists PENDING before Stripe then finalizes payment, order, and stock atomically', async () => {
      const {
        service,
        paymentRepo,
        orderRepo,
        refundRepo,
        productRepo,
        cache,
      } = buildMocks();
      const paid = payment({
        id: 5,
        orderId: 1,
        paymentRef: 'pi_1',
        amount: 25,
        currency: 'usd',
        status: PaymentStatus.PAID,
      });
      const currentOrder = order({
        paymentStatus: PaymentStatus.PAID,
        items: [{ productId: 7, quantity: 2 } as never],
      });
      const refundRecord = {
        id: 9,
        paymentId: 5,
        orderId: 1,
        sourceOrderStatus: OrderStatus.CONFIRMED,
        targetOrderStatus: OrderStatus.CANCELLED,
        amount: 25,
        currency: 'usd',
        idempotencyKey: 'refund:order:tenant_acme:5:v1',
        status: RefundStatus.PROCESSING,
        attempts: 0,
        providerRefundId: 're_1',
        completedAt: null,
      } as OrderRefund;
      paymentRepo.findOne.mockResolvedValue(paid);
      paymentRepo.findOneBy.mockResolvedValue(paid);
      orderRepo.findOne.mockResolvedValue(currentOrder);
      refundRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValue(refundRecord);
      refundRepo.findOneBy.mockResolvedValue(refundRecord);
      refundRepo.save.mockResolvedValue({
        ...refundRecord,
        status: RefundStatus.PENDING,
        providerRefundId: null,
      } as never);
      stripe.refunds.create.mockResolvedValue({
        id: 're_1',
        status: 'succeeded',
        amount: 2500,
      });

      const result = await service.refundOrder(
        currentOrder,
        OrderStatus.CANCELLED,
        { schemaName: TENANT },
      );

      expect(stripe.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_1',
          reverse_transfer: true,
          refund_application_fee: true,
          metadata: {
            durable_refund_id: '9',
            durable_refund_kind: 'order',
            tenant_schema: TENANT,
          },
        },
        { idempotencyKey: 'refund:order:tenant_acme:5:v1' },
      );
      expect(refundRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RefundStatus.PENDING,
          targetOrderStatus: OrderStatus.CANCELLED,
        }),
      );
      expect(paymentRepo.update).toHaveBeenCalledWith(
        { id: 5 },
        { status: PaymentStatus.REFUND_PENDING },
      );
      expect(paymentRepo.update).toHaveBeenCalledWith(
        { id: 5 },
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1, status: OrderStatus.CONFIRMED },
        expect.objectContaining({
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.REFUNDED,
        }),
      );
      expect(productRepo.increment).toHaveBeenCalledWith({ id: 7 }, 'stock', 2);
      expect(result).toMatchObject({ refundStatus: RefundStatus.SUCCEEDED });
      expect(result?.refundedAt).toBeInstanceOf(Date);
      expect(cache.invalidateProducts).toHaveBeenCalledWith({
        schemaName: TENANT,
      });
    });

    it('keeps order REFUND_PENDING when Stripe returns pending', async () => {
      const { service, paymentRepo, orderRepo, refundRepo } = buildMocks();
      const paid = payment({
        id: 5,
        paymentRef: 'pi_1',
        amount: 25,
        currency: 'usd',
        status: PaymentStatus.PAID,
      });
      paymentRepo.findOne.mockResolvedValue(paid);
      paymentRepo.findOneBy.mockResolvedValue(paid);
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.PAID }),
      );
      refundRepo.findOne.mockResolvedValue(null);
      stripe.refunds.create.mockResolvedValue({
        id: 're_pending',
        status: 'pending',
        amount: 2500,
      });

      await expect(
        service.refundOrder(
          order({ paymentStatus: PaymentStatus.PAID }),
          OrderStatus.CANCELLED,
          { schemaName: TENANT },
        ),
      ).resolves.toEqual({
        refundStatus: RefundStatus.PROCESSING,
        refundedAt: null,
      });
      expect(paymentRepo.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
      expect(orderRepo.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: OrderStatus.CANCELLED }),
      );
    });

    it('retains provider refund data when atomic local finalization fails', async () => {
      const { service, paymentRepo, orderRepo, refundRepo, manager } =
        buildMocks();
      const paid = payment({
        id: 5,
        paymentRef: 'pi_1',
        amount: 25,
        currency: 'usd',
        status: PaymentStatus.PAID,
      });
      paymentRepo.findOne.mockResolvedValue(paid);
      paymentRepo.findOneBy.mockResolvedValue(paid);
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.PAID }),
      );
      refundRepo.findOne.mockResolvedValue(null);
      stripe.refunds.create.mockResolvedValue({
        id: 're_1',
        status: 'succeeded',
        amount: 2500,
      });
      paymentRepo.manager.transaction
        .mockImplementationOnce(
          (callback: (value: typeof manager) => unknown) => callback(manager),
        )
        .mockRejectedValueOnce(new Error('coupon restoration failed'));

      await expect(
        service.refundOrder(
          order({ paymentStatus: PaymentStatus.PAID }),
          OrderStatus.CANCELLED,
          { schemaName: TENANT },
        ),
      ).rejects.toThrow('coupon restoration failed');
      expect(refundRepo.update).toHaveBeenCalledWith(
        { id: 9 },
        expect.objectContaining({
          providerRefundId: 're_1',
          providerStatus: 'succeeded',
          status: RefundStatus.PROCESSING,
        }),
      );
      expect(paymentRepo.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
    });

    it('keeps durable PENDING state when Stripe outcome is unknown', async () => {
      const { service, paymentRepo, orderRepo, refundRepo } = buildMocks();
      const paid = payment({
        id: 5,
        paymentRef: 'pi_1',
        amount: 25,
        currency: 'usd',
        status: PaymentStatus.PAID,
      });
      paymentRepo.findOne.mockResolvedValue(paid);
      paymentRepo.findOneBy.mockResolvedValue(paid);
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.PAID }),
      );
      refundRepo.findOne.mockResolvedValue(null);
      stripe.refunds.create.mockRejectedValue(new Error('network'));

      await expect(
        service.refundOrder(
          order({ paymentStatus: PaymentStatus.PAID }),
          OrderStatus.CANCELLED,
          { schemaName: TENANT },
        ),
      ).resolves.toEqual({
        refundStatus: RefundStatus.PENDING,
        refundedAt: null,
      });
      expect(refundRepo.update).toHaveBeenCalledWith(
        { id: 9 },
        expect.objectContaining({
          status: RefundStatus.PENDING,
          lastError: 'network',
          nextRetryAt: expect.any(Date) as Date,
        }),
      );
    });

    it('reverts REFUND_PENDING after a definitive Stripe rejection', async () => {
      const { service, paymentRepo, orderRepo, refundRepo } = buildMocks();
      const paid = payment({
        id: 5,
        paymentRef: 'pi_1',
        amount: 25,
        currency: 'usd',
        status: PaymentStatus.PAID,
      });
      const refundRecord = {
        id: 9,
        paymentId: 5,
        orderId: 1,
        status: RefundStatus.PENDING,
        attempts: 0,
      } as OrderRefund;
      paymentRepo.findOne.mockResolvedValue(paid);
      paymentRepo.findOneBy.mockResolvedValue(paid);
      orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.PAID }),
      );
      refundRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValue(refundRecord);
      refundRepo.findOneBy.mockResolvedValue(refundRecord);
      refundRepo.save.mockResolvedValue(refundRecord as never);
      stripe.refunds.create.mockRejectedValue(new InvalidRequest('nope'));

      await expect(
        service.refundOrder(
          order({ paymentStatus: PaymentStatus.PAID }),
          OrderStatus.CANCELLED,
          { schemaName: TENANT },
        ),
      ).rejects.toThrow('Refund could not be processed');
      expect(paymentRepo.update).toHaveBeenCalledWith(
        { id: 5, status: PaymentStatus.REFUND_PENDING },
        { status: PaymentStatus.PAID },
      );
      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1, paymentStatus: PaymentStatus.REFUND_PENDING },
        { paymentStatus: PaymentStatus.PAID },
      );
    });
  });

  describe('reconcileRefunds', () => {
    it('polls a stored provider refund and clamps the batch limit', async () => {
      const { service, paymentRepo, refundRepo } = buildMocks();
      const refundRecord = {
        id: 9,
        paymentId: 5,
        orderId: 1,
        idempotencyKey: 'refund:order:tenant_acme:5:v1',
        providerRefundId: 're_pending',
        status: RefundStatus.PROCESSING,
        attempts: 2,
      } as OrderRefund;
      const query = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([refundRecord]),
      };
      refundRepo.createQueryBuilder.mockReturnValue(query);
      paymentRepo.findOneBy.mockResolvedValue(
        payment({ id: 5, paymentRef: 'pi_1', status: PaymentStatus.PAID }),
      );
      stripe.refunds.retrieve.mockResolvedValue({
        id: 're_pending',
        status: 'pending',
        failure_reason: null,
      });

      await expect(
        service.reconcileRefunds({ schemaName: TENANT }, 5000),
      ).resolves.toEqual({ attempted: 1, processed: 0, failed: 0 });

      expect(query.take).toHaveBeenCalledWith(1000);
      expect(stripe.refunds.retrieve).toHaveBeenCalledWith('re_pending');
      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(refundRepo.update).toHaveBeenCalledWith(
        { id: 9 },
        expect.objectContaining({ attempts: 3 }),
      );
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

    it.each([PaymentStatus.REFUNDED, PaymentStatus.REFUND_PENDING])(
      'repairs paid timestamps without overwriting %s',
      async (status) => {
        const { service, paymentRepo, orderRepo } = buildMocks();
        paymentRepo.findOne.mockResolvedValue(
          payment({ status, paidAt: null }),
        );
        orderRepo.findOne.mockResolvedValue(
          order({ paymentStatus: status, paidAt: null }),
        );

        await service.successOrderPayment(META, 'pi_1');

        expect(paymentRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status,
            paidAt: expect.any(Date) as Date,
          }),
        );
        expect(orderRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            paymentStatus: status,
            paidAt: expect.any(Date) as Date,
          }),
        );
      },
    );
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

    it.each([PaymentStatus.PAID, PaymentStatus.REFUND_PENDING])(
      'does not let a late cancel overwrite %s',
      async (status) => {
        const { service, paymentRepo, orderRepo } = buildMocks();
        paymentRepo.findOne.mockResolvedValue(payment({ status }));
        orderRepo.findOne.mockResolvedValue(order({ paymentStatus: status }));

        await service.cancelOrderPayment(META, 'pi_1');

        expect(paymentRepo.save).not.toHaveBeenCalled();
        expect(orderRepo.save).not.toHaveBeenCalled();
      },
    );
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

    it.each([PaymentStatus.PAID, PaymentStatus.REFUND_PENDING])(
      'does not let a late failure overwrite %s',
      async (status) => {
        const { service, paymentRepo, orderRepo } = buildMocks();
        paymentRepo.findOne.mockResolvedValue(payment({ status }));
        orderRepo.findOne.mockResolvedValue(order({ paymentStatus: status }));

        await service.failedOrderPayment(META, 'pi_1');

        expect(paymentRepo.save).not.toHaveBeenCalled();
        expect(orderRepo.save).not.toHaveBeenCalled();
      },
    );
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

    it('ignores an unrelated refund event while a durable refund is pending', async () => {
      const mocks = buildMocks();
      mocks.paymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.REFUND_PENDING }),
      );
      mocks.orderRepo.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.REFUND_PENDING }),
      );
      mocks.refundRepo.findOne.mockResolvedValue({
        id: 9,
        paymentId: 1,
        providerRefundId: 're_local',
        status: RefundStatus.PROCESSING,
      });

      await mocks.service.refundedOrderPayment(
        META,
        refund({
          amountRefunded: 0,
          refundReference: 're_other',
          refundRecordId: 77,
          providerStatus: 'failed',
        }),
      );

      expect(mocks.refundRepo.update).not.toHaveBeenCalled();
      expect(mocks.paymentRepo.update).not.toHaveBeenCalled();
      expect(mocks.orderRepo.update).not.toHaveBeenCalled();
    });

    it('finalizes an exactly matched durable refund webhook', async () => {
      const mocks = buildMocks();
      const paid = payment({
        id: 5,
        orderId: 1,
        amount: 25,
        status: PaymentStatus.REFUND_PENDING,
      });
      const currentOrder = order({
        paymentStatus: PaymentStatus.REFUND_PENDING,
        items: [{ productId: 7, quantity: 2 } as never],
      });
      const localRefund = {
        id: 9,
        paymentId: 5,
        orderId: 1,
        sourceOrderStatus: OrderStatus.CONFIRMED,
        targetOrderStatus: OrderStatus.CANCELLED,
        providerRefundId: 're_1',
        status: RefundStatus.PROCESSING,
        completedAt: null,
      } as OrderRefund;
      mocks.paymentRepo.findOne.mockResolvedValue(paid);
      mocks.orderRepo.findOne.mockResolvedValue(currentOrder);
      mocks.refundRepo.findOne.mockResolvedValue(localRefund);
      mocks.refundRepo.findOneBy.mockResolvedValue(localRefund);

      await expect(
        mocks.service.refundedOrderPayment(
          META,
          refund({
            amountRefunded: 2500,
            refundReference: 're_1',
            refundRecordId: 9,
            providerStatus: 'succeeded',
          }),
        ),
      ).resolves.toMatchObject({
        paymentId: 5,
        orderId: 1,
        status: PaymentStatus.REFUNDED,
        refundedAmount: 25,
      });

      expect(mocks.productRepo.increment).toHaveBeenCalledWith(
        { id: 7 },
        'stock',
        2,
      );
      expect(mocks.refundRepo.update).toHaveBeenCalledWith(
        { id: 9 },
        expect.objectContaining({ status: RefundStatus.SUCCEEDED }),
      );
      expect(mocks.cache.invalidateProducts).toHaveBeenCalledWith({
        schemaName: TENANT,
      });
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
