import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { TenantService } from '../../tenants/tenant.service';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import StripePaymentService from '../../payments/stripe.payment.service';
import { Payment } from '../../payments/entities/payment.entity';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const STRIPE_UNAVAILABLE = 'Stripe is unavailable';

@Injectable()
export class PlatformPaymentsService {
  private readonly logger = new Logger(PlatformPaymentsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantManager: TenantManagerService,
    private readonly stripePaymentService: StripePaymentService,
  ) {}

  async getSummary() {
    try {
      const [account, balance] = await Promise.all([
        this.stripePaymentService.getPlatformAccountStatus(),
        this.stripePaymentService.getPlatformBalance(),
      ]);
      return { account, balance, error: null };
    } catch (error) {
      this.logger.warn(
        `Platform Stripe summary failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return { account: null, balance: null, error: STRIPE_UNAVAILABLE };
    }
  }

  async listTenants() {
    const tenants = await this.tenantService.findAll();
    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      status: tenant.status,
      stripeAccountId: tenant.stripeAccountId,
      paymentsPaused: tenant.paymentsPaused,
      payoutsPaused: tenant.payoutsPaused,
    }));
  }

  async getOverview(tenantId: number) {
    const tenant = await this.tenantService.findById(tenantId);
    const account = await this.stripePaymentService.getAccountStatus(tenant);

    let balance: Awaited<ReturnType<StripePaymentService['getBalance']>> = null;
    let payoutScheduleInterval: string | null = null;

    if (account.connected && tenant.stripeAccountId) {
      balance = await this.stripePaymentService.getBalance(
        tenant.stripeAccountId,
      );
      payoutScheduleInterval =
        await this.stripePaymentService.getPayoutSchedule(
          tenant.stripeAccountId,
        );
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        status: tenant.status,
        schemaName: tenant.schemaName,
        stripeAccountId: tenant.stripeAccountId,
      },
      account,
      balance,
      payoutScheduleInterval,
      paymentsPaused: tenant.paymentsPaused,
      payoutsPaused: tenant.payoutsPaused,
    };
  }

  async listCharges(tenantId: number, page: number, limit: number) {
    const tenant = await this.tenantService.findById(tenantId);
    const safeLimit = this.clampLimit(limit);
    const safePage = Math.max(page, 1);

    const paymentRepo = await this.tenantManager.getRepository(Payment, {
      schemaName: tenant.schemaName,
    });

    const [rows, total] = await paymentRepo.findAndCount({
      relations: { order: true },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        orderNumber: row.order?.orderNumber ?? null,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        paymentRef: row.paymentRef,
        refundedAmount: row.refundedAmount,
        createdAt: row.createdAt,
        paidAt: row.paidAt,
        refundedAt: row.refundedAt,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async listPayouts(tenantId: number, limit: number, startingAfter?: string) {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant.stripeAccountId)
      throw new ConflictException('Store is not connected to Stripe');

    const payouts = await this.stripePaymentService.listPayouts(
      tenant.stripeAccountId,
      { limit: this.clampLimit(limit), startingAfter },
    );

    const last = payouts.data[payouts.data.length - 1];

    return {
      data: payouts.data.map((payout) => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        method: payout.method,
        arrivalDate: payout.arrival_date,
        created: payout.created,
        description: payout.description,
      })),
      hasMore: payouts.has_more,
      nextCursor: payouts.has_more && last ? last.id : null,
    };
  }

  async setPaymentsPaused(tenantId: number, paused: boolean) {
    const tenant = await this.tenantService.findById(tenantId);
    if (tenant.paymentsPaused !== paused)
      await this.tenantService.updatePaymentControls(tenantId, {
        paymentsPaused: paused,
      });

    return { paymentsPaused: paused, payoutsPaused: tenant.payoutsPaused };
  }

  async setPayoutsPaused(tenantId: number, paused: boolean) {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant.stripeAccountId)
      throw new ConflictException('Store is not connected to Stripe');

    const accountId = tenant.stripeAccountId;

    if (paused) {
      if (tenant.payoutsPaused)
        return { paymentsPaused: tenant.paymentsPaused, payoutsPaused: true };

      const current =
        await this.stripePaymentService.getPayoutSchedule(accountId);
      const storedInterval =
        current && current !== 'manual'
          ? current
          : tenant.stripePayoutsInterval;

      await this.stripePaymentService.setPayoutInterval(accountId, 'manual');
      await this.tenantService.updatePaymentControls(tenantId, {
        payoutsPaused: true,
        stripePayoutsInterval: storedInterval ?? null,
      });

      return { paymentsPaused: tenant.paymentsPaused, payoutsPaused: true };
    }

    if (!tenant.payoutsPaused)
      return { paymentsPaused: tenant.paymentsPaused, payoutsPaused: false };

    await this.stripePaymentService.setPayoutInterval(
      accountId,
      tenant.stripePayoutsInterval ?? 'daily',
    );
    await this.tenantService.updatePaymentControls(tenantId, {
      payoutsPaused: false,
      stripePayoutsInterval: null,
    });

    return { paymentsPaused: tenant.paymentsPaused, payoutsPaused: false };
  }

  private clampLimit(limit: number): number {
    const fallback = Number.isFinite(limit) ? Math.floor(limit) : DEFAULT_LIMIT;
    return Math.min(Math.max(fallback, 1), MAX_LIMIT);
  }
}
