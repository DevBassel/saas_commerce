import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { tenantStorage } from '../../auth/tenant-context';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { PaymentStatus } from '../constants/payment-status.enum';
import { RefundStatus } from '../constants/refund-status.enum';
import { PaymentsProviders } from '../constants/payments-providers';
import { SubscriptionPayment } from '../entities/subscription-payment.entity';
import { SubscriptionRefund } from '../entities/subscription-refund.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPaymentService } from '../stripe/services/subscription/subscription-payment.service';
import { SubscriptionPaymentStatusService } from '../stripe/services/subscription/subscription-payment-status.service';
import { SubscriptionPaymentIntentService } from '../stripe/services/subscription/subscription-payment-intent.service';
import { SubscriptionRefundService } from '../stripe/services/subscription/subscription-refund.service';

const TENANT_SCHEMA = 'tenant_acme';

const tenant = {
  id: 3,
  schemaName: TENANT_SCHEMA,
} as Tenant;

const withTenant = <T>(fn: () => T): T =>
  tenantStorage.run({ tenant, tenantSchema: TENANT_SCHEMA }, fn);

const firstIntentCreateParams = (
  mock: jest.Mock,
): { metadata: { data: string } } => {
  const calls = mock.mock.calls as unknown as Array<
    [{ metadata: { data: string } }]
  >;
  return calls[0][0];
};

const buildMocks = () => {
  const stripe = {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    refunds: { create: jest.fn(), retrieve: jest.fn() },
  };
  const plansRepo = { findOneBy: jest.fn() };
  const subscriptionRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const subscriptionPaymentRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    save: jest.fn((data: unknown) => data),
    merge: jest.fn((entity: unknown, data: unknown) => {
      Object.assign(entity as object, data as object);
      return entity;
    }),
    manager: { transaction: jest.fn() },
  };
  const subscriptionRefundRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => ({ id: 20, ...(data as object) })),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const manager = {
    findOne: jest.fn((entity: unknown): unknown =>
      entity === Subscription
        ? subscriptionRepo.findOneBy()
        : subscriptionPaymentRepo.findOne(),
    ),
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn((_entity: unknown, value: unknown) => value),
    withRepository: jest.fn((repo: unknown) =>
      repo === subscriptionPaymentRepo
        ? subscriptionPaymentRepo
        : repo === subscriptionRefundRepo
          ? subscriptionRefundRepo
          : subscriptionRepo,
    ),
    getRepository: jest.fn((entity: unknown) =>
      entity === SubscriptionPayment
        ? subscriptionPaymentRepo
        : entity === SubscriptionRefund
          ? subscriptionRefundRepo
          : subscriptionRepo,
    ),
  };
  subscriptionRepo.manager.transaction.mockImplementation(
    (callback: (value: typeof manager) => unknown) => callback(manager),
  );
  subscriptionPaymentRepo.manager.transaction.mockImplementation(
    (callback: (value: typeof manager) => unknown) => callback(manager),
  );
  const subscriptions = {
    assignPlan: jest.fn(),
    downgradeToFree: jest.fn(),
  };
  const stripeClient = { client: stripe as unknown as Stripe };
  const paymentStatus = new SubscriptionPaymentStatusService(
    subscriptionRepo as never,
    subscriptionPaymentRepo as never,
    subscriptions as never,
  );
  const service = new SubscriptionPaymentService(
    new SubscriptionPaymentIntentService(
      stripeClient,
      plansRepo as never,
      subscriptionRepo as never,
    ),
    paymentStatus,
    new SubscriptionRefundService(
      stripeClient,
      plansRepo as never,
      subscriptionRepo as never,
      subscriptionPaymentRepo as never,
      subscriptionRefundRepo as never,
      subscriptions as never,
      paymentStatus,
    ),
  );

  return {
    service,
    stripe,
    plansRepo,
    subscriptionRepo,
    subscriptionPaymentRepo,
    subscriptionRefundRepo,
    manager,
    subscriptions,
  };
};

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: 2,
  active: true,
  isPublic: true,
  monthlyPrice: 29,
  yearlyPrice: 290,
  currency: 'usd',
  ...overrides,
});

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  subscriptionId: 1,
  planId: 2,
  billingInterval: BillingInterval.MONTHLY,
  paymentRef: 'pi_sub_1',
  amount: 29,
  currency: 'usd',
  status: PaymentStatus.PENDING,
  refundedAmount: 0,
  planAppliedAt: null,
  refundDowngradedAt: null,
  refundReference: null,
  refundedAt: null,
  createdAt: new Date(),
  paidAt: new Date(),
  ...overrides,
});

const paidPayment = (overrides: Record<string, unknown> = {}) =>
  payment({
    status: PaymentStatus.PAID,
    ...overrides,
  });

describe('SubscriptionPaymentService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createSubscriptionPaymentIntent', () => {
    it('requires tenant context', async () => {
      const { service } = buildMocks();

      await expect(
        service.createSubscriptionPaymentIntent({ planId: 2 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a monthly platform intent and PENDING ledger row', async () => {
      const { service, stripe, plansRepo, subscriptionRepo, manager } =
        buildMocks();
      plansRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_sub_1',
        client_secret: 'cs_sub_1',
      });

      const result = await withTenant(() =>
        service.createSubscriptionPaymentIntent({ planId: 2 }),
      );

      expect(result).toEqual({ clientSecret: 'cs_sub_1' });
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        {
          amount: 2900,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            data: expect.any(String) as string,
          },
        },
        {
          idempotencyKey: 'tenant:3:subscription:1:plan:2:MONTHLY:payment:v1',
        },
      );
      const monthlyParams = firstIntentCreateParams(
        stripe.paymentIntents.create,
      );
      expect(JSON.parse(monthlyParams.metadata.data) as unknown).toEqual({
        kind: 'subscription',
        subscriptionId: 1,
        tenantId: 3,
        planId: 2,
        billingInterval: BillingInterval.MONTHLY,
        tenant: TENANT_SCHEMA,
      });
      expect(subscriptionRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(manager.findOne).toHaveBeenNthCalledWith(1, Subscription, {
        where: { tenantId: 3 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.findOne).toHaveBeenNthCalledWith(2, SubscriptionPayment, {
        where: {
          subscriptionId: 1,
          provider: PaymentsProviders.STRIPE,
        },
        order: { createdAt: 'DESC' },
      });
      expect(manager.create).toHaveBeenCalledWith(SubscriptionPayment, {
        subscriptionId: 1,
        planId: 2,
        billingInterval: BillingInterval.MONTHLY,
        provider: PaymentsProviders.STRIPE,
        status: PaymentStatus.PENDING,
        amount: 29,
        currency: 'usd',
        paymentRef: 'pi_sub_1',
      });
      expect(manager.save).toHaveBeenCalledWith(
        SubscriptionPayment,
        expect.objectContaining({ paymentRef: 'pi_sub_1' }),
      );
    });

    it('uses yearly price and metadata when requested', async () => {
      const { service, stripe, plansRepo, subscriptionRepo } = buildMocks();
      plansRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      stripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_sub_1',
        client_secret: 'cs_sub_1',
      });

      await withTenant(() =>
        service.createSubscriptionPaymentIntent({
          planId: 2,
          billingInterval: BillingInterval.YEARLY,
        }),
      );

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 29000,
          metadata: {
            data: expect.any(String) as string,
          },
        }),
        {
          idempotencyKey: 'tenant:3:subscription:1:plan:2:YEARLY:payment:v1',
        },
      );
      const yearlyParams = firstIntentCreateParams(
        stripe.paymentIntents.create,
      );
      expect(JSON.parse(yearlyParams.metadata.data) as unknown).toEqual({
        kind: 'subscription',
        subscriptionId: 1,
        tenantId: 3,
        planId: 2,
        billingInterval: BillingInterval.YEARLY,
        tenant: TENANT_SCHEMA,
      });
    });

    it.each([
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
    ])('reuses an existing %s intent', async (status) => {
      const {
        service,
        stripe,
        plansRepo,
        subscriptionRepo,
        subscriptionPaymentRepo,
        manager,
      } = buildMocks();
      plansRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue({
        paymentRef: 'pi_existing',
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        status,
        client_secret: 'cs_existing',
      });

      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).resolves.toEqual({ clientSecret: 'cs_existing' });
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('reuses the latest active intent even when the requested plan changed', async () => {
      const {
        service,
        stripe,
        plansRepo,
        subscriptionRepo,
        subscriptionPaymentRepo,
      } = buildMocks();
      plansRepo.findOneBy.mockResolvedValue(plan({ id: 99 }));
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue({
        paymentRef: 'pi_existing_plan_2',
        planId: 2,
        billingInterval: BillingInterval.MONTHLY,
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        status: 'requires_action',
        client_secret: 'cs_existing',
      });

      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({
            planId: 99,
            billingInterval: BillingInterval.YEARLY,
          }),
        ),
      ).resolves.toEqual({ clientSecret: 'cs_existing' });
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it.each([
      ['succeeded', 'Subscription payment has already been completed'],
      [
        'canceled',
        'Previous subscription payment attempt was canceled. A new payment attempt is required.',
      ],
    ])('rejects an existing %s intent', async (status, message) => {
      const {
        service,
        stripe,
        plansRepo,
        subscriptionRepo,
        subscriptionPaymentRepo,
      } = buildMocks();
      plansRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue({
        paymentRef: 'pi_existing',
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({ status });

      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toThrow(message);
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('maps Stripe invalid-request errors and preserves other errors', async () => {
      const { service, stripe, plansRepo, subscriptionRepo } = buildMocks();
      plansRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      stripe.paymentIntents.create.mockRejectedValueOnce(
        new Stripe.errors.StripeInvalidRequestError({
          type: 'invalid_request_error',
          message: 'invalid',
        } as never),
      );

      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toThrow('Subscription payment could not be started');

      const networkError = new Error('network');
      stripe.paymentIntents.create.mockRejectedValueOnce(networkError);
      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toBe(networkError);
    });

    it('preserves plan validation errors', async () => {
      const { service, plansRepo } = buildMocks();
      plansRepo.findOneBy.mockResolvedValueOnce(null);

      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      plansRepo.findOneBy.mockResolvedValueOnce(plan({ active: false }));
      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toMatchObject({ response: { code: 'PLAN_INACTIVE' } });

      plansRepo.findOneBy.mockResolvedValueOnce(plan({ isPublic: false }));
      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toMatchObject({ response: { code: 'PLAN_NOT_PUBLIC' } });

      plansRepo.findOneBy.mockResolvedValueOnce(plan({ monthlyPrice: 0 }));
      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toMatchObject({ response: { code: 'PLAN_NOT_PURCHASABLE' } });
    });

    it('requires an existing subscription', async () => {
      const { service, plansRepo, subscriptionRepo } = buildMocks();
      plansRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.findOneBy.mockResolvedValue(null);

      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toMatchObject({
        response: { code: 'SUBSCRIPTION_NOT_FOUND' },
      });
    });

    it('fails closed if the subscription disappears before it can be locked', async () => {
      const { service, stripe, plansRepo, subscriptionRepo } = buildMocks();
      plansRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.findOneBy
        .mockResolvedValueOnce({ id: 1, tenantId: 3 })
        .mockResolvedValueOnce(null);

      await expect(
        withTenant(() =>
          service.createSubscriptionPaymentIntent({ planId: 2 }),
        ),
      ).rejects.toMatchObject({
        response: { code: 'SUBSCRIPTION_NOT_FOUND' },
      });
      expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });
  });

  describe('reconcileRefunds', () => {
    it('polls a stored provider refund and clamps the batch limit', async () => {
      const {
        service,
        stripe,
        subscriptionPaymentRepo,
        subscriptionRefundRepo,
      } = buildMocks();
      const refundRecord = {
        id: 20,
        paymentId: 10,
        subscriptionId: 1,
        providerRefundId: 're_pending',
        idempotencyKey: 'refund:subscription:10:v1',
        status: RefundStatus.PROCESSING,
        attempts: 2,
      } as SubscriptionRefund;
      const query = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([refundRecord]),
      };
      subscriptionRefundRepo.createQueryBuilder.mockReturnValue(query);
      subscriptionPaymentRepo.findOneBy.mockResolvedValue(paidPayment());
      stripe.refunds.retrieve.mockResolvedValue({
        id: 're_pending',
        status: 'pending',
        failure_reason: null,
      });

      await expect(service.reconcileRefunds(5000)).resolves.toEqual({
        attempted: 1,
        processed: 0,
        failed: 0,
      });
      expect(query.take).toHaveBeenCalledWith(1000);
      expect(stripe.refunds.retrieve).toHaveBeenCalledWith('re_pending');
      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(subscriptionRefundRepo.update).toHaveBeenCalledWith(
        { id: 20 },
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('webhook reconciliation', () => {
    it('assigns plan before marking payment PAID', async () => {
      const { service, subscriptionPaymentRepo, subscriptions } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(payment());

      await service.successSubscriptionPayment(
        {
          kind: 'subscription',
          subscriptionId: 1,
          tenantId: 3,
          planId: 2,
          billingInterval: BillingInterval.MONTHLY,
          tenant: TENANT_SCHEMA,
        },
        'pi_sub_1',
      );

      expect(subscriptions.assignPlan).toHaveBeenCalledWith(3, {
        planId: 2,
        billingInterval: BillingInterval.MONTHLY,
      });
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        {
          status: PaymentStatus.PAID,
          paidAt: expect.any(Date) as Date,
          planAppliedAt: expect.any(Date) as Date,
        },
      );
      expect(subscriptions.assignPlan.mock.invocationCallOrder[0]).toBeLessThan(
        subscriptionPaymentRepo.update.mock.invocationCallOrder[0],
      );
    });

    it('does nothing when success is redelivered for a PAID row', async () => {
      const { service, subscriptionPaymentRepo, subscriptions } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.PAID, planAppliedAt: new Date() }),
      );

      await service.successSubscriptionPayment({} as never, 'pi_sub_1');

      expect(subscriptions.assignPlan).not.toHaveBeenCalled();
      expect(subscriptionPaymentRepo.update).not.toHaveBeenCalled();
    });

    it('repairs a PAID row whose plan was not applied', async () => {
      const { service, subscriptionPaymentRepo, subscriptions } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.PAID, planAppliedAt: null }),
      );

      await service.successSubscriptionPayment(
        {
          kind: 'subscription',
          subscriptionId: 1,
          tenantId: 3,
          planId: 2,
          billingInterval: BillingInterval.MONTHLY,
          tenant: TENANT_SCHEMA,
        },
        'pi_sub_1',
      );

      expect(subscriptions.assignPlan).toHaveBeenCalled();
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        expect.objectContaining({
          status: PaymentStatus.PAID,
          planAppliedAt: expect.any(Date) as Date,
        }),
      );
    });

    it('uses the webhook transaction manager for subscription writes', async () => {
      const { service, subscriptionPaymentRepo, subscriptions, manager } =
        buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(payment());

      await service.successSubscriptionPayment(
        {
          kind: 'subscription',
          subscriptionId: 1,
          tenantId: 3,
          planId: 2,
          billingInterval: BillingInterval.MONTHLY,
          tenant: TENANT_SCHEMA,
        },
        'pi_sub_1',
        manager as never,
      );

      expect(manager.getRepository).toHaveBeenCalledWith(SubscriptionPayment);
      expect(subscriptionPaymentRepo.findOne).toHaveBeenCalledWith({
        where: { paymentRef: 'pi_sub_1' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(subscriptions.assignPlan).toHaveBeenCalledWith(
        3,
        {
          planId: 2,
          billingInterval: BillingInterval.MONTHLY,
        },
        manager,
      );
    });

    it.each([PaymentStatus.PAID, PaymentStatus.REFUND_PENDING])(
      'does not let late failure or cancel events overwrite %s',
      async (status) => {
        const { service, subscriptionPaymentRepo } = buildMocks();
        subscriptionPaymentRepo.findOne.mockResolvedValue(payment({ status }));

        await service.failedSubscriptionPayment('pi_sub_1', 'late failure');
        await service.cancelSubscriptionPayment('pi_sub_1');

        expect(subscriptionPaymentRepo.update).not.toHaveBeenCalled();
      },
    );

    it('records failure reason and cancel status exactly', async () => {
      const { service, subscriptionPaymentRepo } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(payment());

      await service.failedSubscriptionPayment('pi_sub_1', 'declined');
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        { status: PaymentStatus.FAILED, failureReason: 'declined' },
      );

      subscriptionPaymentRepo.update.mockClear();
      await service.cancelSubscriptionPayment('pi_sub_1');
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        { status: PaymentStatus.CANCELED },
      );
    });

    it('downgrades only after a full refund', async () => {
      const {
        service,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptions,
      } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(payment());
      subscriptionRepo.findOneBy.mockResolvedValue({
        id: 1,
        tenantId: 3,
        planId: 2,
      });

      await service.refundedSubscriptionPayment('pi_sub_1', {
        amountRefunded: 1000,
        refundReference: 're_partial',
      });
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        expect.objectContaining({ status: PaymentStatus.PARTIALLY_REFUNDED }),
      );
      expect(subscriptions.downgradeToFree).not.toHaveBeenCalled();

      await service.refundedSubscriptionPayment('pi_sub_1', {
        amountRefunded: 2900,
        refundReference: 're_full',
      });
      expect(subscriptions.downgradeToFree).toHaveBeenCalledWith(1);
    });

    it('ignores an unrelated refund event while a durable refund is pending', async () => {
      const { service, subscriptionPaymentRepo, subscriptionRefundRepo } =
        buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.REFUND_PENDING }),
      );
      subscriptionRefundRepo.findOne.mockResolvedValue({
        id: 20,
        paymentId: 10,
        providerRefundId: 're_local',
        status: RefundStatus.PROCESSING,
      });

      await service.refundedSubscriptionPayment('pi_sub_1', {
        amountRefunded: 0,
        refundReference: 're_other',
        refundRecordId: 77,
        providerStatus: 'failed',
      });

      expect(subscriptionRefundRepo.update).not.toHaveBeenCalled();
      expect(subscriptionPaymentRepo.update).not.toHaveBeenCalled();
    });

    it('finalizes an exactly matched durable refund webhook', async () => {
      const {
        service,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptionRefundRepo,
        subscriptions,
        manager,
      } = buildMocks();
      const currentPayment = payment({
        status: PaymentStatus.REFUND_PENDING,
      });
      const localRefund = {
        id: 20,
        paymentId: 10,
        subscriptionId: 1,
        providerRefundId: 're_sub_1',
        status: RefundStatus.PROCESSING,
      } as SubscriptionRefund;
      subscriptionPaymentRepo.findOne.mockResolvedValue(currentPayment);
      subscriptionRefundRepo.findOne.mockResolvedValue(localRefund);
      subscriptionRefundRepo.findOneBy.mockResolvedValue(localRefund);
      subscriptionRepo.findOne.mockResolvedValue({
        id: 1,
        tenantId: 3,
        planId: 2,
      });

      await service.refundedSubscriptionPayment(
        'pi_sub_1',
        {
          amountRefunded: 2900,
          refundReference: 're_sub_1',
          refundRecordId: 20,
          providerStatus: 'succeeded',
        },
        manager as never,
      );

      expect(subscriptions.downgradeToFree).toHaveBeenCalledWith(1, manager);
      expect(subscriptionRefundRepo.update).toHaveBeenCalledWith(
        { id: 20 },
        expect.objectContaining({ status: RefundStatus.SUCCEEDED }),
      );
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
    });

    it('does not downgrade a newer subscription plan', async () => {
      const {
        service,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptions,
      } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(payment());
      subscriptionRepo.findOneBy.mockResolvedValue({
        id: 1,
        tenantId: 3,
        planId: 99,
      });

      await service.refundedSubscriptionPayment('pi_sub_1', {
        amountRefunded: 2900,
        refundReference: 're_full',
      });

      expect(subscriptions.downgradeToFree).not.toHaveBeenCalled();
    });

    it('locks the subscription before a transactional refund downgrade', async () => {
      const {
        service,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptions,
        manager,
      } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(payment());
      subscriptionRepo.findOne.mockResolvedValue({
        id: 1,
        tenantId: 3,
        planId: 2,
      });

      await service.refundedSubscriptionPayment(
        'pi_sub_1',
        {
          amountRefunded: 2900,
          refundReference: 're_full',
        },
        manager as never,
      );

      expect(subscriptionRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(subscriptions.downgradeToFree).toHaveBeenCalledWith(1, manager);
    });

    it('restores only the free plan created by an earlier full refund', async () => {
      const {
        service,
        plansRepo,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptions,
      } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(
        payment({
          status: PaymentStatus.REFUNDED,
          planAppliedAt: new Date(),
          refundDowngradedAt: new Date(),
        }),
      );
      subscriptionRepo.findOneBy.mockResolvedValue({
        id: 1,
        tenantId: 3,
        planId: 1,
      });
      plansRepo.findOneBy.mockResolvedValue({ id: 1, slug: 'free' });

      await service.refundedSubscriptionPayment('pi_sub_1', {
        amountRefunded: 1000,
        refundReference: 're_reversed',
      });

      expect(subscriptions.assignPlan).toHaveBeenCalledWith(3, {
        planId: 2,
        billingInterval: BillingInterval.MONTHLY,
      });
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        { refundDowngradedAt: null },
      );
    });
  });

  describe('platform cancellation', () => {
    it('downgrades when no PAID purchase exists', async () => {
      const {
        service,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptions,
      } = buildMocks();
      subscriptionRepo.findOneBy
        .mockResolvedValueOnce({ id: 1, tenantId: 3 })
        .mockResolvedValueOnce({ id: 1, planId: 1 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelSubscriptionWithRefund(3)).resolves.toEqual({
        id: 1,
        planId: 1,
      });
      expect(subscriptions.downgradeToFree).toHaveBeenCalledWith(1);
    });

    it('preserves missing payment-reference error on tenant cancellation', async () => {
      const { service, subscriptionRepo, subscriptionPaymentRepo } =
        buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.PAID, paymentRef: null }),
      );

      await expect(service.cancelOwnSubscription(3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('tenant cancellation', () => {
    it('throws when the tenant has no subscription', async () => {
      const { service, subscriptionRepo } = buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue(null);

      await expect(service.cancelOwnSubscription(3)).rejects.toMatchObject({
        response: { code: 'SUBSCRIPTION_NOT_FOUND' },
      });
    });

    it('rejects when there is no paid purchase', async () => {
      const { service, stripe, subscriptionRepo, subscriptionPaymentRepo } =
        buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelOwnSubscription(3)).rejects.toMatchObject({
        response: { code: 'SUBSCRIPTION_NOT_REFUNDABLE' },
      });
      expect(stripe.refunds.create).not.toHaveBeenCalled();
    });

    it('rejects once the refund window has passed', async () => {
      const { service, stripe, subscriptionRepo, subscriptionPaymentRepo } =
        buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(
        paidPayment({ paidAt: new Date(Date.now() - 8 * 86_400_000) }),
      );

      await expect(service.cancelOwnSubscription(3)).rejects.toMatchObject({
        response: { code: 'REFUND_WINDOW_EXPIRED' },
      });
      expect(stripe.refunds.create).not.toHaveBeenCalled();
    });

    it('uses createdAt when paidAt is missing', async () => {
      const { service, subscriptionRepo, subscriptionPaymentRepo } =
        buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(
        paidPayment({
          paidAt: null,
          createdAt: new Date(Date.now() - 8 * 86_400_000),
        }),
      );

      await expect(service.cancelOwnSubscription(3)).rejects.toMatchObject({
        response: { code: 'REFUND_WINDOW_EXPIRED' },
      });
    });

    it('returns an existing successful durable refund without Stripe', async () => {
      const {
        service,
        stripe,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptionRefundRepo,
      } = buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(paidPayment());
      subscriptionRefundRepo.findOne.mockResolvedValue({
        id: 20,
        paymentId: 10,
        subscriptionId: 1,
        status: RefundStatus.SUCCEEDED,
      });

      await expect(service.cancelOwnSubscription(3)).resolves.toEqual({
        subscription: { id: 1, tenantId: 3 },
        refundStatus: RefundStatus.SUCCEEDED,
      });
      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(stripe.refunds.retrieve).not.toHaveBeenCalled();
    });

    it('rejects an existing failed durable refund without Stripe', async () => {
      const {
        service,
        stripe,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptionRefundRepo,
      } = buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(paidPayment());
      subscriptionRefundRepo.findOne.mockResolvedValue({
        id: 20,
        paymentId: 10,
        subscriptionId: 1,
        status: RefundStatus.FAILED,
      });

      await expect(service.cancelOwnSubscription(3)).rejects.toThrow(
        'Refund could not be processed',
      );
      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(stripe.refunds.retrieve).not.toHaveBeenCalled();
    });

    it('refunds, downgrades, and returns the subscription', async () => {
      const {
        service,
        stripe,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptionRefundRepo,
        manager,
        subscriptions,
      } = buildMocks();
      subscriptionRepo.findOneBy
        .mockResolvedValueOnce({ id: 1, tenantId: 3 })
        .mockResolvedValueOnce({ id: 1, tenantId: 3, planId: 2 });
      const paid = paidPayment();
      const refundRecord = {
        id: 20,
        paymentId: 10,
        subscriptionId: 1,
        amount: 29,
        currency: 'usd',
        idempotencyKey: 'refund:subscription:10:v1',
        status: RefundStatus.PROCESSING,
        attempts: 0,
        providerRefundId: 're_sub_1',
      } as SubscriptionRefund;
      subscriptionPaymentRepo.findOne.mockResolvedValue(paid);
      subscriptionPaymentRepo.findOneBy.mockResolvedValue(paid);
      subscriptionRefundRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValue(refundRecord);
      subscriptionRefundRepo.findOneBy.mockResolvedValue(refundRecord);
      subscriptionRefundRepo.save.mockResolvedValue({
        ...refundRecord,
        status: RefundStatus.PENDING,
        providerRefundId: null,
      } as never);
      subscriptionRepo.findOne.mockResolvedValue({
        id: 1,
        tenantId: 3,
        planId: 2,
      });
      stripe.refunds.create.mockResolvedValue({
        id: 're_sub_1',
        status: 'succeeded',
        amount: 2900,
      });

      await expect(service.cancelOwnSubscription(3)).resolves.toEqual({
        subscription: { id: 1, tenantId: 3, planId: 2 },
        refundStatus: RefundStatus.SUCCEEDED,
      });
      expect(stripe.refunds.create).toHaveBeenCalledWith(
        {
          payment_intent: 'pi_sub_1',
          metadata: {
            durable_refund_id: '20',
            durable_refund_kind: 'subscription',
          },
        },
        { idempotencyKey: 'refund:subscription:10:v1' },
      );
      expect(subscriptionRefundRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 10,
          status: RefundStatus.PENDING,
        }),
      );
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundedAmount: 29,
          refundReference: 're_sub_1',
        }),
      );
      expect(subscriptions.downgradeToFree).toHaveBeenCalledWith(1, manager);
    });

    it('keeps subscription active while Stripe refund is pending', async () => {
      const {
        service,
        stripe,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptionRefundRepo,
        subscriptions,
      } = buildMocks();
      const paid = paidPayment();
      subscriptionRepo.findOneBy
        .mockResolvedValueOnce({ id: 1, tenantId: 3 })
        .mockResolvedValueOnce({ id: 1, tenantId: 3, planId: 2 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(paid);
      subscriptionPaymentRepo.findOneBy.mockResolvedValue(paid);
      subscriptionRefundRepo.findOne.mockResolvedValue(null);
      stripe.refunds.create.mockResolvedValue({
        id: 're_pending',
        status: 'pending',
        amount: 2900,
      });

      await expect(service.cancelOwnSubscription(3)).resolves.toEqual({
        subscription: { id: 1, tenantId: 3, planId: 2 },
        refundStatus: RefundStatus.PROCESSING,
      });

      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        { status: PaymentStatus.REFUND_PENDING },
      );
      expect(subscriptionPaymentRepo.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
      expect(subscriptions.downgradeToFree).not.toHaveBeenCalled();
    });

    it('retains provider refund data when subscription finalization fails', async () => {
      const {
        service,
        stripe,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptionRefundRepo,
        manager,
      } = buildMocks();
      const paid = paidPayment();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(paid);
      subscriptionPaymentRepo.findOneBy.mockResolvedValue(paid);
      subscriptionRefundRepo.findOne.mockResolvedValue(null);
      stripe.refunds.create.mockResolvedValue({
        id: 're_sub_1',
        status: 'succeeded',
        amount: 2900,
      });
      subscriptionPaymentRepo.manager.transaction
        .mockImplementationOnce(
          (callback: (value: typeof manager) => unknown) => callback(manager),
        )
        .mockRejectedValueOnce(new Error('downgrade failed'));

      await expect(service.cancelOwnSubscription(3)).rejects.toThrow(
        'downgrade failed',
      );
      expect(subscriptionRefundRepo.update).toHaveBeenCalledWith(
        { id: 20 },
        expect.objectContaining({
          providerRefundId: 're_sub_1',
          providerStatus: 'succeeded',
          status: RefundStatus.PROCESSING,
        }),
      );
      expect(subscriptionPaymentRepo.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
    });

    it('is idempotent when the purchase was already refunded', async () => {
      const {
        service,
        stripe,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptions,
      } = buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(paidPayment({ status: PaymentStatus.REFUNDED }));

      await service.cancelOwnSubscription(3);

      expect(stripe.refunds.create).not.toHaveBeenCalled();
      expect(subscriptions.downgradeToFree).toHaveBeenCalledWith(1);
    });

    it('maps Stripe invalid-request errors to BadRequestException', async () => {
      const {
        service,
        stripe,
        subscriptionRepo,
        subscriptionPaymentRepo,
        subscriptionRefundRepo,
      } = buildMocks();
      const paid = paidPayment();
      subscriptionRepo.findOneBy.mockResolvedValue({ id: 1, tenantId: 3 });
      subscriptionPaymentRepo.findOne.mockResolvedValue(paid);
      subscriptionPaymentRepo.findOneBy.mockResolvedValue(paid);
      subscriptionRefundRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          id: 20,
          paymentId: 10,
          subscriptionId: 1,
          status: RefundStatus.PENDING,
        });
      subscriptionRefundRepo.findOneBy.mockResolvedValue({
        id: 20,
        paymentId: 10,
        subscriptionId: 1,
        status: RefundStatus.PENDING,
      });
      stripe.refunds.create.mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          type: 'invalid_request_error',
          message: 'nope',
        } as never),
      );

      await expect(service.cancelOwnSubscription(3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(subscriptionPaymentRepo.update).toHaveBeenCalledWith(
        { id: 10, status: PaymentStatus.REFUND_PENDING },
        { status: PaymentStatus.PAID },
      );
    });
  });
});
