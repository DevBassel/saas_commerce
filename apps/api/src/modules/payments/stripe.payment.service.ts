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
import { TenantRef } from '../tenants/tenant.utils';
import { tenantRefFromContext, getTenantContext } from '../auth/tenant-context';
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
import { paymentMetaData } from './constants/payment-metadata';

@Injectable()
export default class StripePaymentService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripePaymentService.name);
  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly tenantManager: TenantManagerService,
    private readonly paymentService: PaymentService,
  ) {
    const { secretKey } = this.config.getOrThrow<IStripe>('stripe');
    this.stripe = new Stripe(secretKey);
  }

  async repos(tenant?: TenantRef) {
    const target = tenant ?? tenantRefFromContext();
    if (!target) throw new ForbiddenException('Tenant context is required');
    const [paymentRepo, orderRepo] = await Promise.all([
      this.tenantManager.getRepository(Payment, target),
      this.tenantManager.getRepository(Order, target),
    ]);
    return { paymentRepo, orderRepo };
  }

  async createPayment(createPaymentDto: CreatePaymentDto) {
    const { orderId } = createPaymentDto;
    const { orderRepo, paymentRepo } = await this.repos();
    const order = await orderRepo.findOne({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    // allow order payment for 24h after created time
    const isPaymentExpired =
      order.createdAt.getDate() < new Date().getDate() - 1;

    if (isPaymentExpired)
      throw new ForbiddenException('Order payment has expired');

    const tenant = getTenantContext()?.tenant;
    if (tenant?.paymentsPaused)
      throw new ConflictException('Payments are paused for this store');

    const stripeAccountId = tenant?.stripeAccountId;
    if (!stripeAccountId)
      throw new ConflictException('Store is not connected to Stripe');

    const amount = Math.round(order.total * 100);
    const { applicationFeeBps } = this.config.getOrThrow<IStripe>('stripe');
    const applicationFeeAmount = Math.round(
      (amount * applicationFeeBps) / 10000,
    );

    const params: Stripe.PaymentIntentCreateParams = {
      amount,
      currency: 'usd',
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
        currency: 'usd',
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

  async webHook(req: RawBodyRequest<Request>, sig: string) {
    if (!req.rawBody) throw new BadRequestException('Raw body is required');
    let event: Stripe.Event;
    const { webhookSecret } = this.config.getOrThrow<IStripe>('stripe');
    try {
      console.log('webhook call');
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        webhookSecret,
      );
    } catch (err) {
      console.log(err);
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.created':
        console.log('create');
        break;
      case 'payment_intent.succeeded':
      case 'payment_intent.canceled':
      case 'payment_intent.payment_failed': {
        const payment = event.data.object as Stripe.PaymentIntent;
        if (!payment.metadata?.data) {
          this.logger.warn(
            `Stripe ${event.type} for ${payment.id} has no metadata.data; ignoring`,
          );
          return;
        }
        const data = JSON.parse(payment.metadata.data) as paymentMetaData;
        if (event.type === 'payment_intent.succeeded')
          return await this.paymentService.successPayment(data, payment.id);
        if (event.type === 'payment_intent.canceled')
          return await this.paymentService.canceledPayment(data, payment.id);
        return await this.paymentService.failedPayment(data, payment.id);
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return;
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

  private isMissingAccount(error: unknown): boolean {
    return (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      (error.code === 'resource_missing' || error.code === 'account_invalid')
    );
  }

  async getBalance(accountId: string): Promise<{
    available: { amount: number; currency: string }[];
    pending: { amount: number; currency: string }[];
  } | null> {
    try {
      const balance = await this.stripe.balance.retrieve(
        {},
        { stripeAccount: accountId },
      );
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
    } catch (error) {
      if (this.isMissingAccount(error)) return null;
      throw error;
    }
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
