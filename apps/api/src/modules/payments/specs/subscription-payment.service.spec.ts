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
import { PaymentsProviders } from '../constants/payments-providers';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';

const TENANT_SCHEMA = 'tenant_acme';

const tenant = {
  id: 3,
  schemaName: TENANT_SCHEMA,
} as Tenant;

const withTenant = <T>(fn: () => T): T =>
  tenantStorage.run({ tenant, tenantSchema: TENANT_SCHEMA }, fn);

const buildMocks = () => {
  const stripe = {
    paymentIntents: {
      create: jest.fn<Promise<unknown>, [Stripe.PaymentIntentCreateParams]>(),
    },
    refunds: { create: jest.fn() },
  };
  const plansRepo = { findOneBy: jest.fn() };
  const subscriptionRepo = { findOneBy: jest.fn() };
  const subscriptionPaymentRepo = {
    findOne: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => value),
    update: jest.fn(),
  };
  const subscriptions = {
    assignPlan: jest.fn(),
    downgradeToFree: jest.fn(),
  };
  const service = new SubscriptionPaymentService(
    { client: stripe as unknown as Stripe },
    plansRepo as never,
    subscriptionRepo as never,
    subscriptionPaymentRepo as never,
    subscriptions as never,
  );

  return {
    service,
    stripe,
    plansRepo,
    subscriptionRepo,
    subscriptionPaymentRepo,
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
  paymentRef: 'pi_sub_1',
  amount: 29,
  status: PaymentStatus.PENDING,
  refundedAmount: 0,
  refundReference: null,
  refundedAt: null,
  createdAt: new Date(),
  paidAt: new Date(),
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
      const {
        service,
        stripe,
        plansRepo,
        subscriptionRepo,
        subscriptionPaymentRepo,
      } = buildMocks();
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
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2900,
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          data: JSON.stringify({
            kind: 'subscription',
            subscriptionId: 1,
            tenantId: 3,
            planId: 2,
            billingInterval: BillingInterval.MONTHLY,
            tenant: TENANT_SCHEMA,
          }),
        },
      });
      expect(subscriptionPaymentRepo.create).toHaveBeenCalledWith({
        subscriptionId: 1,
        planId: 2,
        billingInterval: BillingInterval.MONTHLY,
        provider: PaymentsProviders.STRIPE,
        status: PaymentStatus.PENDING,
        amount: 29,
        currency: 'usd',
        paymentRef: 'pi_sub_1',
      });
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
            data: JSON.stringify({
              kind: 'subscription',
              subscriptionId: 1,
              tenantId: 3,
              planId: 2,
              billingInterval: BillingInterval.YEARLY,
              tenant: TENANT_SCHEMA,
            }),
          },
        }),
      );
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
        { status: PaymentStatus.PAID, paidAt: expect.any(Date) as Date },
      );
      expect(subscriptions.assignPlan.mock.invocationCallOrder[0]).toBeLessThan(
        subscriptionPaymentRepo.update.mock.invocationCallOrder[0],
      );
    });

    it('does nothing when success is redelivered for a PAID row', async () => {
      const { service, subscriptionPaymentRepo, subscriptions } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(
        payment({ status: PaymentStatus.PAID }),
      );

      await service.successSubscriptionPayment({} as never, 'pi_sub_1');

      expect(subscriptions.assignPlan).not.toHaveBeenCalled();
      expect(subscriptionPaymentRepo.update).not.toHaveBeenCalled();
    });

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
      const { service, subscriptionPaymentRepo, subscriptions } = buildMocks();
      subscriptionPaymentRepo.findOne.mockResolvedValue(payment());

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
});
