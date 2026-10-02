import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import Stripe from 'stripe';
import { IENV } from 'src/common/config/env.interface';
import { tenantStorage } from '../auth/tenant-context';
import { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';
import { Order } from '../orders/entities/order.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from './constants/payment-status.enum';
import { PaymentsProviders } from './constants/payments-providers';
import PaymentService from './payments.service';
import StripePaymentService from './stripe.payment.service';

jest.mock('stripe', () => {
  class StripeInvalidRequestError extends Error {
    code?: string;
    constructor(message = 'invalid', code?: string) {
      super(message);
      this.code = code;
    }
  }
  const instance = {
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
    refunds: { create: jest.fn() },
    charges: { retrieve: jest.fn() },
    accounts: { retrieve: jest.fn(), update: jest.fn(), create: jest.fn() },
    balance: { retrieve: jest.fn() },
    payouts: { list: jest.fn() },
    accountLinks: { create: jest.fn() },
  };
  const StripeMock = jest.fn(() => instance) as unknown as {
    errors: { StripeInvalidRequestError: typeof StripeInvalidRequestError };
    __instance: typeof instance;
  };
  StripeMock.errors = { StripeInvalidRequestError };
  StripeMock.__instance = instance;
  return { __esModule: true, default: StripeMock };
});

const StripeMock = Stripe as unknown as {
  errors: {
    StripeInvalidRequestError: new (
      m?: string,
      c?: string,
    ) => Error & {
      code?: string;
    };
  };
  __instance: {
    paymentIntents: { create: jest.Mock; retrieve: jest.Mock };
    webhooks: { constructEvent: jest.Mock };
    refunds: { create: jest.Mock };
    charges: { retrieve: jest.Mock };
    accounts: { retrieve: jest.Mock; update: jest.Mock; create: jest.Mock };
    balance: { retrieve: jest.Mock };
    payouts: { list: jest.Mock };
    accountLinks: { create: jest.Mock };
  };
};

const stripe = StripeMock.__instance;
const InvalidRequest = StripeMock.errors.StripeInvalidRequestError;

const firstCallArg = (mock: jest.Mock): Record<string, unknown> => {
  const calls = mock.mock.calls as unknown as Array<[Record<string, unknown>]>;
  return calls[0][0];
};

const TENANT_SCHEMA = 'tenant_acme';

const tenantEntity = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 3,
    schemaName: TENANT_SCHEMA,
    stripeAccountId: 'acct_1',
    currency: 'usd',
    paymentsPaused: false,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as Tenant;

const orderEntity = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 1,
    userId: 7,
    total: 25,
    paymentStatus: PaymentStatus.UNPAID,
    createdAt: new Date(),
    ...overrides,
  }) as unknown as Order;

const buildConfig = (
  overrides: {
    stripe?: Record<string, unknown>;
    app?: Record<string, unknown>;
    cors?: Record<string, unknown>;
  } = {},
): ConfigService<IENV> => {
  const stripeCfg = {
    secretKey: 'sk_test_123',
    publishableKey: 'pk_test_123',
    webhookSecret: 'whsec_123',
    applicationFeeBps: 0,
    ...overrides.stripe,
  };
  const app = { rootDomain: 'example.com', ...overrides.app };
  const cors = { origin: 'http://localhost:5174', ...overrides.cors };
  return {
    getOrThrow: jest.fn((key: string) =>
      key === 'stripe'
        ? stripeCfg
        : key === 'app'
          ? app
          : key === 'cors'
            ? cors
            : undefined,
    ),
  } as unknown as ConfigService<IENV>;
};

const buildMocks = (config = buildConfig()) => {
  const paymentRepo = {
    findOne: jest.fn(),
    save: jest.fn((data: unknown) => data),
    update: jest.fn(),
  };
  const orderRepo = {
    findOne: jest.fn(),
    save: jest.fn((data: unknown) => data),
  };
  const tenantManager = {
    getRepository: jest.fn((entity: unknown) =>
      Promise.resolve(entity === Payment ? paymentRepo : orderRepo),
    ),
  } as unknown as TenantManagerService;
  const paymentService = {
    successPayment: jest.fn(),
    canceledPayment: jest.fn(),
    failedPayment: jest.fn(),
    refundedPayment: jest.fn(),
  };
  const service = new StripePaymentService(
    config,
    tenantManager,
    paymentService as unknown as PaymentService,
  );
  return {
    service,
    paymentRepo,
    orderRepo,
    tenantManager,
    paymentService,
    config,
  };
};

const withTenant = <T>(tenant: Tenant, fn: () => T): T =>
  tenantStorage.run({ tenant, tenantSchema: TENANT_SCHEMA }, fn);

const webhookReq = (rawBody?: Buffer) =>
  ({ rawBody }) as RawBodyRequest<Request>;

describe('StripePaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('throws NotFound when the order does not exist', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        withTenant(tenantEntity(), () => service.createPayment({ orderId: 1 })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an order older than 24 hours', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(
        orderEntity({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }),
      );

      await expect(
        withTenant(tenantEntity(), () => service.createPayment({ orderId: 1 })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects payment when the tenant has payments paused', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity());

      await expect(
        withTenant(tenantEntity({ paymentsPaused: true }), () =>
          service.createPayment({ orderId: 1 }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects payment when the store is not connected to Stripe', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity());

      await expect(
        withTenant(tenantEntity({ stripeAccountId: null }), () =>
          service.createPayment({ orderId: 1 }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a destination-charge payment intent and mirrors PENDING', async () => {
      const { service, orderRepo, paymentRepo } = buildMocks();
      const order = orderEntity();
      orderRepo.findOne.mockResolvedValue(order);
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_1',
        client_secret: 'cs_1',
      });

      const result = await withTenant(tenantEntity(), () =>
        service.createPayment({ orderId: 1 }),
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
        JSON.stringify({ orderId: 1, userId: 7, tenant: TENANT_SCHEMA }),
      );
      expect(params).not.toHaveProperty('application_fee_amount');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          order,
          amount: 25,
          currency: 'usd',
          provider: PaymentsProviders.STRIPE,
          status: PaymentStatus.PENDING,
          paymentRef: 'pi_1',
        }),
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: PaymentStatus.PENDING }),
      );
    });

    it('adds the application fee only when it is greater than zero', async () => {
      const { service, orderRepo } = buildMocks(
        buildConfig({ stripe: { applicationFeeBps: 100 } }),
      );
      orderRepo.findOne.mockResolvedValue(orderEntity());
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_1',
        client_secret: 'cs_1',
      });

      await withTenant(tenantEntity(), () =>
        service.createPayment({ orderId: 1 }),
      );

      expect(firstCallArg(stripe.paymentIntents.create)).toMatchObject({
        application_fee_amount: 25,
      });
    });

    it('maps StripeInvalidRequestError to a 400', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity());
      stripe.paymentIntents.create.mockRejectedValue(
        new InvalidRequest('bad', 'card_declined'),
      );

      await expect(
        withTenant(tenantEntity(), () => service.createPayment({ orderId: 1 })),
      ).rejects.toThrow('Store cannot accept payments right now');
    });

    it('propagates non-Stripe errors', async () => {
      const { service, orderRepo } = buildMocks();
      orderRepo.findOne.mockResolvedValue(orderEntity());
      const boom = new Error('network down');
      stripe.paymentIntents.create.mockRejectedValue(boom);

      await expect(
        withTenant(tenantEntity(), () => service.createPayment({ orderId: 1 })),
      ).rejects.toBe(boom);
    });
  });

  describe('webHook', () => {
    it('rejects a request without a raw body', async () => {
      const { service } = buildMocks();

      await expect(service.webHook(webhookReq(), 'sig')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an invalid signature', async () => {
      const { service } = buildMocks();
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(
        service.webHook(webhookReq(Buffer.from('{}')), 'sig'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    const dispatch = (type: string, object: Record<string, unknown>) => {
      stripe.webhooks.constructEvent.mockReturnValue({
        type,
        data: { object },
      });
    };

    it('dispatches payment_intent.succeeded to successPayment', async () => {
      const { service, paymentService } = buildMocks();
      const meta = { orderId: 1, userId: 7, tenant: TENANT_SCHEMA };
      dispatch('payment_intent.succeeded', {
        id: 'pi_1',
        metadata: { data: JSON.stringify(meta) },
      });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.successPayment).toHaveBeenCalledWith(meta, 'pi_1');
    });

    it('dispatches payment_intent.canceled to canceledPayment', async () => {
      const { service, paymentService } = buildMocks();
      const meta = { orderId: 1, userId: 7, tenant: TENANT_SCHEMA };
      dispatch('payment_intent.canceled', {
        id: 'pi_1',
        metadata: { data: JSON.stringify(meta) },
      });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.canceledPayment).toHaveBeenCalledWith(meta, 'pi_1');
    });

    it('dispatches payment_intent.payment_failed to failedPayment', async () => {
      const { service, paymentService } = buildMocks();
      const meta = { orderId: 1, userId: 7, tenant: TENANT_SCHEMA };
      dispatch('payment_intent.payment_failed', {
        id: 'pi_1',
        metadata: { data: JSON.stringify(meta) },
      });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.failedPayment).toHaveBeenCalledWith(meta, 'pi_1');
    });

    it('ignores an intent event without metadata.data', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('payment_intent.succeeded', { id: 'pi_1' });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.successPayment).not.toHaveBeenCalled();
    });

    it('handles charge.refunded with a string payment_intent', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('charge.refunded', {
        id: 'ch_1',
        payment_intent: 'pi_1',
        refunds: { data: [{ id: 're_1' }] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        metadata: {
          data: JSON.stringify({
            orderId: 1,
            userId: 7,
            tenant: TENANT_SCHEMA,
          }),
        },
        latest_charge: { amount_refunded: 50 },
      });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_1', {
        expand: ['latest_charge'],
      });
      expect(paymentService.refundedPayment).toHaveBeenCalledWith(
        { orderId: 1, userId: 7, tenant: TENANT_SCHEMA },
        {
          paymentIntentId: 'pi_1',
          amountRefunded: 50,
          refundReference: 're_1',
        },
      );
    });

    it('handles charge.refunded with an expanded payment_intent object', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('charge.refunded', {
        id: 'ch_1',
        payment_intent: { id: 'pi_2' },
        refunds: { data: [] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        metadata: {
          data: JSON.stringify({
            orderId: 1,
            userId: 7,
            tenant: TENANT_SCHEMA,
          }),
        },
        latest_charge: { amount_refunded: 0 },
      });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_2', {
        expand: ['latest_charge'],
      });
      expect(paymentService.refundedPayment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ refundReference: null }),
      );
    });

    it('ignores charge.refunded without a payment_intent', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('charge.refunded', { id: 'ch_1', refunds: { data: [] } });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
      expect(paymentService.refundedPayment).not.toHaveBeenCalled();
    });

    it.each(['pending', 'requires_action'])(
      'skips refund lifecycle events with status %s',
      async (status) => {
        const { service, paymentService } = buildMocks();
        dispatch('refund.updated', {
          id: 're_1',
          status,
          payment_intent: 'pi_1',
        });

        await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

        expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
        expect(paymentService.refundedPayment).not.toHaveBeenCalled();
      },
    );

    it('reconciles a succeeded refund using the refund id as reference', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('refund.created', {
        id: 're_9',
        status: 'succeeded',
        payment_intent: 'pi_1',
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        metadata: {
          data: JSON.stringify({
            orderId: 1,
            userId: 7,
            tenant: TENANT_SCHEMA,
          }),
        },
        latest_charge: { amount_refunded: 100 },
      });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.refundedPayment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ refundReference: 're_9' }),
      );
    });

    it('reconciles a failed refund with a null reference', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('refund.failed', {
        id: 're_9',
        status: 'failed',
        failure_reason: 'expired',
        payment_intent: 'pi_1',
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        metadata: {
          data: JSON.stringify({
            orderId: 1,
            userId: 7,
            tenant: TENANT_SCHEMA,
          }),
        },
        latest_charge: { amount_refunded: 0 },
      });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.refundedPayment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ refundReference: null }),
      );
    });

    it('ignores a refund event without a payment_intent', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('refund.updated', { id: 're_1', status: 'succeeded' });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.refundedPayment).not.toHaveBeenCalled();
    });

    it('fetches a string latest_charge via charges.retrieve', async () => {
      const { service } = buildMocks();
      dispatch('charge.refunded', {
        id: 'ch_1',
        payment_intent: 'pi_1',
        refunds: { data: [{ id: 're_1' }] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        metadata: {
          data: JSON.stringify({
            orderId: 1,
            userId: 7,
            tenant: TENANT_SCHEMA,
          }),
        },
        latest_charge: 'ch_1',
      });
      stripe.charges.retrieve.mockResolvedValue({ amount_refunded: 25 });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(stripe.charges.retrieve).toHaveBeenCalledWith('ch_1');
    });

    it('ignores a refund when the payment intent has no metadata', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('charge.refunded', {
        id: 'ch_1',
        payment_intent: 'pi_1',
        refunds: { data: [] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({ latest_charge: null });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.refundedPayment).not.toHaveBeenCalled();
    });

    it('ignores a refund when there is no charge', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('charge.refunded', {
        id: 'ch_1',
        payment_intent: 'pi_1',
        refunds: { data: [] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        metadata: {
          data: JSON.stringify({
            orderId: 1,
            userId: 7,
            tenant: TENANT_SCHEMA,
          }),
        },
        latest_charge: null,
      });

      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.refundedPayment).not.toHaveBeenCalled();
    });

    it('ignores payment_intent.created and unknown events', async () => {
      const { service, paymentService } = buildMocks();
      dispatch('payment_intent.created', { id: 'pi_1' });
      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');
      dispatch('customer.created', { id: 'cus_1' });
      await service.webHook(webhookReq(Buffer.from('{}')), 'sig');

      expect(paymentService.successPayment).not.toHaveBeenCalled();
      expect(paymentService.refundedPayment).not.toHaveBeenCalled();
    });
  });

  describe('refundOrder', () => {
    it('returns null when there is no paid payment', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refundOrder(orderEntity(), { schemaName: TENANT_SCHEMA }),
      ).resolves.toBeNull();
      expect(stripe.refunds.create).not.toHaveBeenCalled();
    });

    it('rejects a paid payment without a payment reference', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue({ id: 5, paymentRef: null });

      await expect(
        service.refundOrder(orderEntity(), { schemaName: TENANT_SCHEMA }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates an idempotent reverse-transfer refund and marks the payment REFUNDED', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue({
        id: 5,
        paymentRef: 'pi_1',
        amount: 25,
      });
      stripe.refunds.create.mockResolvedValue({ id: 're_1' });

      const result = await service.refundOrder(orderEntity(), {
        schemaName: TENANT_SCHEMA,
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

    it('maps StripeInvalidRequestError to a 400', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue({ id: 5, paymentRef: 'pi_1' });
      stripe.refunds.create.mockRejectedValue(new InvalidRequest('nope'));

      await expect(
        service.refundOrder(orderEntity(), { schemaName: TENANT_SCHEMA }),
      ).rejects.toThrow('Refund could not be processed');
    });

    it('propagates non-Stripe errors', async () => {
      const { service, paymentRepo } = buildMocks();
      paymentRepo.findOne.mockResolvedValue({ id: 5, paymentRef: 'pi_1' });
      const boom = new Error('network');
      stripe.refunds.create.mockRejectedValue(boom);

      await expect(
        service.refundOrder(orderEntity(), { schemaName: TENANT_SCHEMA }),
      ).rejects.toBe(boom);
    });
  });

  describe('account and balance helpers', () => {
    it('reports disconnected when the tenant has no Stripe account', async () => {
      const { service } = buildMocks();

      await expect(
        service.getAccountStatus(tenantEntity({ stripeAccountId: null })),
      ).resolves.toEqual({
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
    });

    it('maps a retrieved account', async () => {
      const { service } = buildMocks();
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
    });

    it('maps a missing account to disconnected with the stored id', async () => {
      const { service } = buildMocks();
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
      const { service } = buildMocks();
      const boom = new Error('stripe down');
      stripe.accounts.retrieve.mockRejectedValue(boom);

      await expect(service.getAccountStatus(tenantEntity())).rejects.toBe(boom);
    });

    it('reads the platform account with a null id', async () => {
      const { service } = buildMocks();
      stripe.accounts.retrieve.mockResolvedValue({
        id: 'acct_platform',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      });

      await expect(service.getPlatformAccountStatus()).resolves.toEqual(
        expect.objectContaining({ accountId: 'acct_platform' }),
      );
      expect(stripe.accounts.retrieve).toHaveBeenCalledWith(null);
    });

    it('returns a mapped balance for a connected account', async () => {
      const { service } = buildMocks();
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
      const { service } = buildMocks();
      stripe.balance.retrieve.mockRejectedValue(
        new InvalidRequest('missing', 'account_invalid'),
      );

      await expect(service.getBalance('acct_1')).resolves.toBeNull();
    });

    it('reads the platform balance without an account', async () => {
      const { service } = buildMocks();
      stripe.balance.retrieve.mockResolvedValue({ available: [], pending: [] });

      await service.getPlatformBalance();

      expect(stripe.balance.retrieve).toHaveBeenCalledWith();
    });

    it('lists payouts with clamping handled by the caller', async () => {
      const { service } = buildMocks();
      stripe.payouts.list.mockResolvedValue({ data: [], has_more: false });

      await service.listPayouts('acct_1', {
        limit: 10,
        startingAfter: 'po_1',
      });

      expect(stripe.payouts.list).toHaveBeenCalledWith(
        { limit: 10, starting_after: 'po_1' },
        { stripeAccount: 'acct_1' },
      );
    });

    it('reads the payout schedule and returns null when missing', async () => {
      const { service } = buildMocks();
      stripe.accounts.retrieve.mockResolvedValue({
        settings: { payouts: { schedule: { interval: 'weekly' } } },
      });

      await expect(service.getPayoutSchedule('acct_1')).resolves.toBe('weekly');

      stripe.accounts.retrieve.mockRejectedValue(
        new InvalidRequest('missing', 'resource_missing'),
      );
      await expect(service.getPayoutSchedule('acct_1')).resolves.toBeNull();
    });

    it('updates the payout interval', async () => {
      const { service } = buildMocks();
      stripe.accounts.update.mockResolvedValue({ id: 'acct_1' });

      await service.setPayoutInterval('acct_1', 'manual');

      expect(stripe.accounts.update).toHaveBeenCalledWith('acct_1', {
        settings: { payouts: { schedule: { interval: 'manual' } } },
      });
    });

    it('creates an express connected account with tenant metadata', async () => {
      const { service } = buildMocks();
      stripe.accounts.create.mockResolvedValue({ id: 'acct_new' });

      await service.createConnectedAccount('owner@test.dev', TENANT_SCHEMA);

      expect(stripe.accounts.create).toHaveBeenCalledWith({
        type: 'express',
        email: 'owner@test.dev',
        metadata: { tenant: TENANT_SCHEMA },
      });
    });
  });

  describe('connectAccount', () => {
    const req = (overrides: Record<string, unknown> = {}) =>
      ({
        tenant: tenantEntity(),
        user: { email: 'owner@test.dev' },
        headers: { origin: 'http://localhost:5174' },
        ...overrides,
      }) as unknown as RequestWithUser;

    it('forbids a request without a tenant', async () => {
      const { service } = buildMocks();
      await expect(
        service.connectAccount(req({ tenant: undefined })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('reuses an existing account and returns an onboarding link', async () => {
      const { service } = buildMocks();
      stripe.accountLinks.create.mockResolvedValue({ url: 'https://onboard' });

      const result = await service.connectAccount(req());

      expect(stripe.accounts.create).not.toHaveBeenCalled();
      expect(stripe.accountLinks.create).toHaveBeenCalledWith({
        account: 'acct_1',
        refresh_url: 'http://localhost:5174/settings/payments',
        return_url: 'http://localhost:5174/settings/payments?stripe=return',
        type: 'account_onboarding',
      });
      expect(result).toEqual({ url: 'https://onboard' });
    });

    it('creates and persists a connected account when missing', async () => {
      const { service } = buildMocks();
      const tenant = tenantEntity({ stripeAccountId: null });
      stripe.accounts.create.mockResolvedValue({ id: 'acct_new' });
      stripe.accountLinks.create.mockResolvedValue({ url: 'https://onboard' });

      await service.connectAccount(req({ tenant }));

      expect(tenant.stripeAccountId).toBe('acct_new');
      expect(
        (tenant as unknown as { save: jest.Mock }).save,
      ).toHaveBeenCalled();
    });

    it('trusts a subdomain of the root domain', async () => {
      const { service } = buildMocks();
      stripe.accountLinks.create.mockResolvedValue({ url: 'https://onboard' });

      await service.connectAccount(
        req({ headers: { origin: 'http://acme.example.com' } }),
      );

      expect(stripe.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: 'http://acme.example.com/settings/payments?stripe=return',
        }),
      );
    });

    it('falls back to configured URLs for an untrusted origin', async () => {
      const { service } = buildMocks(
        buildConfig({
          stripe: {
            onboardingReturnUrl: 'https://app.example.com/return',
            onboardingRefreshUrl: 'https://app.example.com/refresh',
          },
        }),
      );
      stripe.accountLinks.create.mockResolvedValue({ url: 'https://onboard' });

      await service.connectAccount(
        req({ headers: { origin: 'http://evil.test' } }),
      );

      expect(stripe.accountLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: 'https://app.example.com/return',
          refresh_url: 'https://app.example.com/refresh',
        }),
      );
    });

    it('rejects an untrusted origin when no fallback URLs are configured', async () => {
      const { service } = buildMocks();

      await expect(
        service.connectAccount(
          req({ headers: { origin: 'http://evil.test' } }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
