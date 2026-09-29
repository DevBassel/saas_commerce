import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import { tenantRefFromContext } from '../auth/tenant-context';
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

    const payment = await this.stripe.paymentIntents.create({
      amount: order.total * 100,
      currency: 'usd',
      metadata: {
        data: JSON.stringify({
          orderId: order.id,
          userId: order.userId!,
          tenant: tenantRefFromContext()?.schemaName,
        }),
      },
    });

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
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        webhookSecret,
      );
    } catch (err) {
      console.log(err);
      throw new BadRequestException('Invalid webhook signature');
    }

    const payment = event.data.object as Stripe.PaymentIntent;
    if (!payment.metadata.data)
      throw new BadRequestException('metadata is required!');

    const data = JSON.parse(payment.metadata.data) as paymentMetaData;

    console.log(payment.id);
    switch (event.type) {
      case 'payment_intent.created':
        console.log('create');
        break;
      case 'payment_intent.succeeded':
        return await this.paymentService.successPayment(data, payment.id);
      case 'payment_intent.canceled':
        return await this.paymentService.canceledPayment(data, payment.id);
      case 'payment_intent.payment_failed':
        return await this.paymentService.failedPayment(data, payment.id);

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return;
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
