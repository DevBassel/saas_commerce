import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IAPP, ICORS, IENV, IStripe } from 'src/common/config/env.interface';
import {
  hostnameFromOrigin,
  isRootDomainOrigin,
} from 'src/common/config/cors.util';
import { RequestWithUser } from '../../../auth/interfaces/RequestWithUser.interface';
import { Tenant } from '../../../tenants/entities/tenant.entity';
import { StripeAccountStatus } from '../../constants/stripe-account';
import { StripeClientService } from '../stripe-client.service';

type BalanceSnapshot = {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
};

@Injectable()
export class StripeConnectService {
  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly stripeClient: StripeClientService,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.client;
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
