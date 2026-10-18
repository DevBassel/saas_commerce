import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type RawBodyRequest,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { IAPP, ICORS, IENV, IStripe } from 'src/common/config/env.interface';
import {
  hostnameFromOrigin,
  isRootDomainOrigin,
} from 'src/common/config/cors.util';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { getTenantContext, tenantRefFromContext } from '../auth/tenant-context';
import { resolveTenantScope } from '../tenants/utils/tenant-scope';
import { toMinorUnit } from '../../common/utils/money';
import { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { PaymentStatus } from './constants/payment-status.enum';
import { PaymentsProviders } from './constants/payments-providers';
import { StripeAccountStatus } from './constants/stripe-account';
import type { Request } from 'express';
import PaymentService from './payments.service';
import {
  isSubscriptionPaymentMetaData,
  paymentMetaData,
  subscriptionPaymentMetaData,
} from './constants/payment-metadata';
import { CreateSubDto } from './dto/create-sub.dto';
import { SUBSCRIPTION_REFUND_WINDOW_DAYS } from '../subscriptions/constants/subscription.constants';
import { SubscriptionPlan } from '../subscriptions/entities/subscription-plan.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { BillingInterval } from '../subscriptions/constants/billing-interval.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

type BalanceSnapshot = {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
};

@Injectable()
export default class StripePaymentService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripePaymentService.name);
  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly tenantManager: TenantManagerService,
    private readonly paymentService: PaymentService,
    @InjectRepository(SubscriptionPlan)
    private readonly plansRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPayment)
    private readonly subscriptionPaymentRepo: Repository<SubscriptionPayment>,
  ) {
    const { secretKey } = this.config.getOrThrow<IStripe>('stripe');
    this.stripe = new Stripe(secretKey);
  }

  async repos(tenant?: TenantRef) {
    const target = resolveTenantScope(tenant);
    const [paymentRepo, orderRepo] = await Promise.all([
      this.tenantManager.getRepository(Payment, target),
      this.tenantManager.getRepository(Order, target),
    ]);
    return { paymentRepo, orderRepo };
  }

  async createOrderPaymentIntent(createPaymentDto: CreatePaymentDto) {
    const { orderId } = createPaymentDto;
    const { orderRepo, paymentRepo } = await this.repos();
    const order = await orderRepo.findOne({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    // allow order payment for 24h after created time
    const isPaymentExpired =
      Date.now() - order.createdAt.getTime() > 24 * 60 * 60 * 1000;

    if (isPaymentExpired)
      throw new BadRequestException(
        'Payment window has expired. Orders can only be paid within 24 hours of creation.',
      );

    const tenant = getTenantContext()?.tenant;
    if (tenant?.paymentsPaused)
      throw new ConflictException('Payments are paused for this store');

    const stripeAccountId = tenant?.stripeAccountId;
    if (!stripeAccountId)
      throw new ConflictException('Store is not connected to Stripe');

    const amount = toMinorUnit(order.total);
    const { applicationFeeBps } = this.config.getOrThrow<IStripe>('stripe');
    const applicationFeeAmount = Math.round(
      (amount * applicationFeeBps) / 10000,
    );

    const params: Stripe.PaymentIntentCreateParams = {
      amount,
      currency: tenant.currency,
      transfer_data: { destination: stripeAccountId },
      payment_method_types: ['card'],
      metadata: {
        data: JSON.stringify({
          orderId: order.id,
          userId: order.userId!,
          tenant: tenantRefFromContext()?.schemaName,
        }),
      },
    };
    if (applicationFeeAmount > 0)
      params.application_fee_amount = applicationFeeAmount;

    let payment: Stripe.PaymentIntent;
    try {
      payment = await this.stripe.paymentIntents.create(params);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        this.logger.warn(
          `Stripe payment intent create failed: ${error.code ?? error.message}`,
        );
        throw new BadRequestException('Store cannot accept payments right now');
      }
      throw error;
    }

    await Promise.all([
      paymentRepo.save({
        order,
        amount: order.total,
        currency: tenant.currency,
        provider: PaymentsProviders.STRIPE,
        status: PaymentStatus.PENDING,
        paymentRef: payment.id,
      }),
      orderRepo.save({
        ...order,
        paymentStatus: PaymentStatus.PENDING,
      }),
    ]);
    return {
      clientSecret: payment.client_secret,
    };
  }

  async createSubscriptionPaymentIntent(createSubDto: CreateSubDto) {
    const tenant = getTenantContext()?.tenant;
    if (!tenant) throw new ForbiddenException('Tenant context is required');

    const plan = await this.plansRepo.findOneBy({ id: createSubDto.planId });
    if (!plan)
      throw new NotFoundException(`Plan ${createSubDto.planId} not found`);
    if (!plan.active)
      throw new BadRequestException({
        code: 'PLAN_INACTIVE',
        message: 'Plan is inactive',
      });
    if (!plan.isPublic)
      throw new BadRequestException({
        code: 'PLAN_NOT_PUBLIC',
        message: 'Plan is not available for purchase',
      });

    const billingInterval =
      createSubDto.billingInterval ?? BillingInterval.MONTHLY;
    const amount =
      billingInterval === BillingInterval.YEARLY
        ? plan.yearlyPrice
        : plan.monthlyPrice;
    if (amount <= 0)
      throw new BadRequestException({
        code: 'PLAN_NOT_PURCHASABLE',
        message: 'Plan has no price for the selected interval',
      });

    const subscription = await this.subscriptionRepo.findOneBy({
      tenantId: tenant.id,
    });
    if (!subscription)
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found',
      });

    const metadata: subscriptionPaymentMetaData = {
      kind: 'subscription',
      subscriptionId: subscription.id,
      tenantId: tenant.id,
      planId: plan.id,
      billingInterval,
      tenant: tenant.schemaName,
    };

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create({
        amount: toMinorUnit(amount),
        currency: plan.currency,
        payment_method_types: ['card'],
        metadata: { data: JSON.stringify(metadata) },
      });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        this.logger.warn(
          `Stripe subscription intent create failed: ${
            error.code ?? error.message
          }`,
        );
        throw new BadRequestException(
          'Subscription payment could not be started',
        );
      }
      throw error;
    }

    await this.subscriptionPaymentRepo.save(
      this.subscriptionPaymentRepo.create({
        subscriptionId: subscription.id,
        planId: plan.id,
        billingInterval,
        provider: PaymentsProviders.STRIPE,
        status: PaymentStatus.PENDING,
        amount,
        currency: plan.currency,
        paymentRef: intent.id,
      }),
    );

    return { clientSecret: intent.client_secret };
  }

  async webHook(req: RawBodyRequest<Request>, sig: string) {
    if (!req.rawBody) throw new BadRequestException('Raw body is required');
    let event: Stripe.Event;
    const { webhookSecret } = this.config.getOrThrow<IStripe>('stripe');
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        webhookSecret,
      );
    } catch (err) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.canceled':
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        if (!intent.metadata?.data) {
          this.logger.warn(
            `Stripe ${event.type} for ${intent.id} has no metadata.data; ignoring`,
          );
          return;
        }
        const data = JSON.parse(intent.metadata.data) as
          paymentMetaData | subscriptionPaymentMetaData;
        if (isSubscriptionPaymentMetaData(data))
          return await this.handleSubscriptionEvents(event, intent, data);
        return await this.handleOrderPaymentEvents(event, intent, data);
      }

      // Refund lifecycle events do not carry PaymentIntent metadata. The
      // intent is fetched once here to classify the event, then routed to the
      // kind's handler.
      case 'charge.refunded':
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
      case 'charge.refund.updated': {
        const context = this.resolveRefundContext(event);
        if (!context) return;

        const intent = await this.stripe.paymentIntents.retrieve(
          context.paymentIntentId,
          { expand: ['latest_charge'] },
        );
        if (!intent.metadata?.data) {
          this.logger.warn(
            `Stripe refund for ${context.paymentIntentId} has no metadata.data; ignoring`,
          );
          return;
        }
        const data = JSON.parse(intent.metadata.data) as
          paymentMetaData | subscriptionPaymentMetaData;
        if (isSubscriptionPaymentMetaData(data))
          return await this.handleSubscriptionEvents(
            event,
            intent,
            data,
            context.refundReference,
          );
        return await this.handleOrderPaymentEvents(
          event,
          intent,
          data,
          context.refundReference,
        );
      }

      default:
        this.logger.debug(`Unhandled event type ${event.type}`);
    }

    return;
  }

  private async handleOrderPaymentEvents(
    event: Stripe.Event,
    intent: Stripe.PaymentIntent,
    data: paymentMetaData,
    refundReference: string | null = null,
  ): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.paymentService.successOrderPayment(data, intent.id);
      case 'payment_intent.canceled':
        return await this.paymentService.cancelOrderPayment(data, intent.id);
      case 'payment_intent.payment_failed':
        return await this.paymentService.failedOrderPayment(data, intent.id);
      default: {
        const charge = await this.latestCharge(intent);
        if (!charge) {
          this.logger.warn(
            `Stripe refund for ${intent.id} has no charge; ignoring`,
          );
          return;
        }
        return await this.paymentService.refundedOrderPayment(data, {
          paymentIntentId: intent.id,
          amountRefunded: charge.amount_refunded,
          refundReference,
        });
      }
    }
  }

  private async handleSubscriptionEvents(
    event: Stripe.Event,
    intent: Stripe.PaymentIntent,
    data: subscriptionPaymentMetaData,
    refundReference: string | null = null,
  ): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.paymentService.successSubscriptionPayment(
          data,
          intent.id,
        );
      case 'payment_intent.canceled':
        return await this.paymentService.cancelSubscriptionPayment(intent.id);
      case 'payment_intent.payment_failed':
        return await this.paymentService.failedSubscriptionPayment(
          intent.id,
          intent.last_payment_error?.message ?? null,
        );
      default: {
        const charge = await this.latestCharge(intent);
        if (!charge) {
          this.logger.warn(
            `Stripe refund for ${intent.id} has no charge; ignoring`,
          );
          return;
        }
        return await this.paymentService.refundedSubscriptionPayment(
          intent.id,
          {
            amountRefunded: charge.amount_refunded,
            refundReference,
          },
        );
      }
    }
  }

  /** Resolves the intent id + refund reference from a refund-family event. */
  private resolveRefundContext(
    event: Stripe.Event,
  ): { paymentIntentId: string; refundReference: string | null } | null {
    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!paymentIntentId) {
        this.logger.warn(
          `Stripe ${event.type} for charge ${charge.id} has no payment_intent; ignoring`,
        );
        return null;
      }
      return {
        paymentIntentId,
        refundReference: charge.refunds?.data?.[0]?.id ?? null,
      };
    }

    const refund = event.data.object as Stripe.Refund;
    if (refund.status === 'pending' || refund.status === 'requires_action')
      return null;

    const paymentIntentId =
      typeof refund.payment_intent === 'string'
        ? refund.payment_intent
        : refund.payment_intent?.id;
    if (!paymentIntentId) {
      this.logger.warn(
        `Stripe ${event.type} for refund ${refund.id} has no payment_intent; ignoring`,
      );
      return null;
    }

    if (refund.status !== 'succeeded')
      this.logger.warn(
        `Stripe ${event.type} for refund ${refund.id} is ${refund.status}${
          refund.failure_reason ? ` (${refund.failure_reason})` : ''
        }`,
      );

    return {
      paymentIntentId,
      refundReference: refund.status === 'succeeded' ? refund.id : null,
    };
  }

  private async latestCharge(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<Stripe.Charge | null> {
    const charge = paymentIntent.latest_charge;
    if (!charge) return null;
    if (typeof charge === 'string')
      return await this.stripe.charges.retrieve(charge);
    return charge;
  }

  /**
   * Refunds the paid payment tied to an order and marks it REFUNDED.
   *
   * Stripe must never be called inside a DB transaction, so callers invoke this
   * before committing the order state change. Returns null when the order has
   * no paid payment to refund.
   */
  async refundOrder(
    order: Order,
    tenant?: TenantRef,
  ): Promise<{ refundedAt: Date } | null> {
    const { paymentRepo } = await this.repos(tenant);
    const payment = await paymentRepo.findOne({
      where: { orderId: order.id, status: PaymentStatus.PAID },
      order: { id: 'DESC' },
    });
    if (!payment) return null;
    if (!payment.paymentRef)
      throw new BadRequestException('Payment reference is missing');

    let refund: Stripe.Refund;
    try {
      refund = await this.stripe.refunds.create(
        {
          payment_intent: payment.paymentRef,
          reverse_transfer: true,
          refund_application_fee: true,
        },
        { idempotencyKey: `refund-${payment.id}` },
      );
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        this.logger.warn(
          `Stripe refund failed for payment ${payment.id}: ${error.code ?? error.message}`,
        );
        throw new BadRequestException('Refund could not be processed');
      }
      throw error;
    }

    const refundedAt = new Date();
    await paymentRepo.update(
      { id: payment.id },
      {
        status: PaymentStatus.REFUNDED,
        refundedAmount: payment.amount,
        refundReference: refund.id,
        refundedAt,
      },
    );

    return { refundedAt };
  }

  /**
   * Refunds a paid `SubscriptionPayment` on the **platform** Stripe account and
   * marks the ledger row `REFUNDED`. The plan charge runs on the platform
   * account, so the refund must not reverse a transfer or refund an application
   * fee (unlike `refundOrder`). The idempotency key is shared with the platform
   * cancel route so a tenant cancel + the refund webhook never double-refund.
   */
  private async refundSubscriptionPayment(
    payment: SubscriptionPayment,
  ): Promise<void> {
    if (!payment.paymentRef)
      throw new BadRequestException('Payment reference is missing');

    let refund: Stripe.Refund;
    try {
      refund = await this.stripe.refunds.create(
        { payment_intent: payment.paymentRef },
        { idempotencyKey: `refund-subscription-${payment.id}` },
      );
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        this.logger.warn(
          `Stripe subscription refund failed for payment ${
            payment.id
          }: ${error.code ?? error.message}`,
        );
        throw new BadRequestException('Refund could not be processed');
      }
      throw error;
    }

    await this.subscriptionPaymentRepo.update(
      { id: payment.id },
      {
        status: PaymentStatus.REFUNDED,
        refundedAmount: payment.amount,
        refundReference: refund.id,
        refundedAt: new Date(),
      },
    );
  }

  /**
   * Platform (Super Admin) override: cancels a tenant's subscription and refunds
   * its latest paid plan purchase with **no** time window. The tenant ends on the
   * free plan (`downgradeToFree`). Idempotent: once the payment is REFUNDED a
   * repeat call finds no PAID row and only re-runs the (no-op) downgrade.
   */
  async cancelSubscriptionWithRefund(tenantId: number) {
    const subscription = await this.subscriptionRepo.findOneBy({ tenantId });
    if (!subscription)
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found',
      });

    const payment = await this.subscriptionPaymentRepo.findOne({
      where: { subscriptionId: subscription.id, status: PaymentStatus.PAID },
      order: { id: 'DESC' },
    });

    if (payment?.paymentRef) await this.refundSubscriptionPayment(payment);

    await this.paymentService.downgradeSubscriptionToFree(subscription.id);
    return this.subscriptionRepo.findOneBy({ id: subscription.id });
  }

  /**
   * Tenant self-serve cancel + refund: refunds the tenant's latest **PAID** plan
   * purchase and drops them to the free plan, but only within
   * `SUBSCRIPTION_REFUND_WINDOW_DAYS` of that purchase (`paidAt`, falling back
   * to `createdAt`). Only `PAID` rows are considered, so an in-flight upgrade
   * never blocks refunding the earlier paid purchase. Idempotent: a repeat of an
   * already-refunded cancellation re-runs the (no-op) downgrade and returns 200.
   */
  async cancelOwnSubscription(tenantId: number) {
    const subscription = await this.subscriptionRepo.findOneBy({ tenantId });
    if (!subscription)
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found',
      });

    const latestPaid = await this.subscriptionPaymentRepo.findOne({
      where: { subscriptionId: subscription.id, status: PaymentStatus.PAID },
      order: { id: 'DESC' },
    });

    if (!latestPaid) {
      const alreadyRefunded = await this.subscriptionPaymentRepo.findOne({
        where: {
          subscriptionId: subscription.id,
          status: PaymentStatus.REFUNDED,
        },
        order: { id: 'DESC' },
      });
      if (!alreadyRefunded)
        throw new ConflictException({
          code: 'SUBSCRIPTION_NOT_REFUNDABLE',
          message: 'No paid subscription purchase to refund',
        });
      // Idempotent: repeat of an already-refunded cancellation.
      await this.paymentService.downgradeSubscriptionToFree(subscription.id);
      return this.subscriptionRepo.findOneBy({ id: subscription.id });
    }

    const paidAt = latestPaid.paidAt ?? latestPaid.createdAt;
    const deadline = new Date(
      paidAt.getTime() + SUBSCRIPTION_REFUND_WINDOW_DAYS * 86_400_000,
    );
    if (Date.now() > deadline.getTime())
      throw new ConflictException({
        code: 'REFUND_WINDOW_EXPIRED',
        message: `Refund window closed on ${deadline.toISOString()}`,
      });

    await this.refundSubscriptionPayment(latestPaid);
    await this.paymentService.downgradeSubscriptionToFree(subscription.id);
    return this.subscriptionRepo.findOneBy({ id: subscription.id });
  }

  async getAccountStatus(tenant: Tenant): Promise<StripeAccountStatus> {
    if (!tenant.stripeAccountId) {
      return {
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    try {
      const account = await this.stripe.accounts.retrieve(
        tenant.stripeAccountId,
      );
      return {
        connected: true,
        accountId: account.id,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
      };
    } catch (error) {
      // A deleted or foreign account is not a transient failure: report the
      // tenant as disconnected. Any other Stripe error is rethrown so outages
      // surface instead of silently reporting "not connected".
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        (error.code === 'resource_missing' || error.code === 'account_invalid')
      ) {
        return {
          connected: false,
          accountId: tenant.stripeAccountId,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        };
      }
      throw error;
    }
  }

  async getPlatformAccountStatus(): Promise<StripeAccountStatus> {
    const account = await this.stripe.accounts.retrieve(null);
    return {
      connected: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
    };
  }

  private isMissingAccount(error: unknown): boolean {
    return (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      (error.code === 'resource_missing' || error.code === 'account_invalid')
    );
  }

  private mapBalance(balance: Stripe.Balance): BalanceSnapshot {
    return {
      available: balance.available.map((entry) => ({
        amount: entry.amount,
        currency: entry.currency,
      })),
      pending: balance.pending.map((entry) => ({
        amount: entry.amount,
        currency: entry.currency,
      })),
    };
  }

  async getBalance(accountId: string): Promise<BalanceSnapshot | null> {
    try {
      const balance = await this.stripe.balance.retrieve(
        {},
        { stripeAccount: accountId },
      );
      return this.mapBalance(balance);
    } catch (error) {
      if (this.isMissingAccount(error)) return null;
      throw error;
    }
  }

  async getPlatformBalance(): Promise<BalanceSnapshot> {
    const balance = await this.stripe.balance.retrieve();
    return this.mapBalance(balance);
  }

  async listPayouts(
    accountId: string,
    opts: { limit: number; startingAfter?: string },
  ) {
    return this.stripe.payouts.list(
      {
        limit: opts.limit,
        starting_after: opts.startingAfter,
      },
      { stripeAccount: accountId },
    );
  }

  async getPayoutSchedule(accountId: string): Promise<string | null> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return account.settings?.payouts?.schedule?.interval ?? null;
    } catch (error) {
      if (this.isMissingAccount(error)) return null;
      throw error;
    }
  }

  async setPayoutInterval(accountId: string, interval: string) {
    return this.stripe.accounts.update(accountId, {
      settings: { payouts: { schedule: { interval } } },
    });
  }

  async createConnectedAccount(email: string, tenant: string) {
    return this.stripe.accounts.create({
      type: 'express',
      email,
      metadata: {
        tenant,
      },
    });
  }

  private trustedRequestOrigin(
    origin: string | undefined,
    allowedOrigins: string,
    rootDomain?: string,
  ): string | undefined {
    if (!origin) return undefined;
    if (!hostnameFromOrigin(origin)) return undefined;

    const normalized = origin.trim().toLowerCase();
    const allowed = allowedOrigins
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);

    if (
      !allowed.includes(normalized) &&
      !isRootDomainOrigin(origin, rootDomain)
    )
      return undefined;

    return origin.trim().replace(/\/+$/, '');
  }

  private resolveOnboardingUrls(req: RequestWithUser): {
    returnUrl: string;
    refreshUrl: string;
  } {
    const { onboardingReturnUrl, onboardingRefreshUrl } =
      this.config.getOrThrow<IStripe>('stripe');
    const { rootDomain } = this.config.getOrThrow<IAPP>('app');
    const { origin } = this.config.getOrThrow<ICORS>('cors');

    const requestOrigin = this.trustedRequestOrigin(
      req.headers.origin,
      origin,
      rootDomain,
    );

    if (requestOrigin) {
      return {
        returnUrl: `${requestOrigin}/settings/payments?stripe=return`,
        refreshUrl: `${requestOrigin}/settings/payments`,
      };
    }

    if (!onboardingReturnUrl || !onboardingRefreshUrl)
      throw new BadRequestException(
        'Stripe onboarding return/refresh URLs are not configured',
      );

    return {
      returnUrl: onboardingReturnUrl,
      refreshUrl: onboardingRefreshUrl,
    };
  }

  async createOnboardingLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string,
  ) {
    return this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
  }

  async connectAccount(req: RequestWithUser) {
    const tenant = req.tenant;
    if (!tenant) throw new ForbiddenException('Tenant context is required');

    let accountId = tenant.stripeAccountId;

    if (!accountId) {
      const account = await this.createConnectedAccount(
        req.user.email,
        tenant.schemaName,
      );
      accountId = account.id;
      tenant.stripeAccountId = accountId;
      await tenant.save();
    }

    const { returnUrl, refreshUrl } = this.resolveOnboardingUrls(req);
    const link = await this.createOnboardingLink(
      accountId,
      returnUrl,
      refreshUrl,
    );

    return { url: link.url };
  }
}
