import { Injectable, Logger, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/constants/order-status.enum';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantService } from '../tenants/tenant.service';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { StripeAccountStatus } from './constants/stripe-account';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSubDto } from './dto/create-sub.dto';
import { OrderPaymentService } from './stripe/services/order/order-payment.service';
import { StripeConnectService } from './stripe/services/stripe-connect.service';
import { SubscriptionPaymentService } from './stripe/services/subscription/subscription-payment.service';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';

@Injectable()
export default class StripePaymentService {
  private readonly logger = new Logger(StripePaymentService.name);

  constructor(
    private readonly orderPayments: OrderPaymentService,
    private readonly subscriptionPayments: SubscriptionPaymentService,
    private readonly webhooks: StripeWebhookService,
    private readonly connect: StripeConnectService,
    private readonly tenants: TenantService,
  ) {}

  repos(tenant?: TenantRef) {
    return this.orderPayments.repos(tenant);
  }

  createOrderPaymentIntent(
    createPaymentDto: CreatePaymentDto,
    user: RequestWithUser['user'],
  ) {
    return this.orderPayments.createOrderPaymentIntent(createPaymentDto, user);
  }

  createSubscriptionPaymentIntent(createSubDto: CreateSubDto) {
    return this.subscriptionPayments.createSubscriptionPaymentIntent(
      createSubDto,
    );
  }

  webHook(req: RawBodyRequest<Request>, sig: string) {
    return this.webhooks.webHook(req, sig);
  }

  reconcileWebhookEvents(limit?: number) {
    return this.webhooks.reconcileEvents(limit);
  }

  async reconcileRefunds(limit = 100) {
    const subscriptions =
      await this.subscriptionPayments.reconcileRefunds(limit);
    const tenants = await this.tenants.findAll();
    const orders = { attempted: 0, processed: 0, failed: 0 };

    for (const tenant of tenants) {
      try {
        const result = await this.orderPayments.reconcileRefunds(
          { schemaName: tenant.schemaName },
          limit,
        );
        orders.attempted += result.attempted;
        orders.processed += result.processed;
        orders.failed += result.failed;
      } catch (error) {
        orders.attempted += 1;
        orders.failed += 1;
        this.logger.error(
          `Refund reconciliation failed for ${tenant.schemaName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      attempted: subscriptions.attempted + orders.attempted,
      processed: subscriptions.processed + orders.processed,
      failed: subscriptions.failed + orders.failed,
      subscriptions,
      orders,
    };
  }

  refundOrder(order: Order, targetStatus: OrderStatus, tenant?: TenantRef) {
    return this.orderPayments.refundOrder(order, targetStatus, tenant);
  }

  cancelSubscriptionWithRefund(tenantId: number) {
    return this.subscriptionPayments.cancelSubscriptionWithRefund(tenantId);
  }

  cancelOwnSubscription(tenantId: number) {
    return this.subscriptionPayments.cancelOwnSubscription(tenantId);
  }

  getAccountStatus(tenant: Tenant): Promise<StripeAccountStatus> {
    return this.connect.getAccountStatus(tenant);
  }

  getPlatformAccountStatus(): Promise<StripeAccountStatus> {
    return this.connect.getPlatformAccountStatus();
  }

  getBalance(accountId: string) {
    return this.connect.getBalance(accountId);
  }

  getPlatformBalance() {
    return this.connect.getPlatformBalance();
  }

  listPayouts(
    accountId: string,
    opts: { limit: number; startingAfter?: string },
  ) {
    return this.connect.listPayouts(accountId, opts);
  }

  getPayoutSchedule(accountId: string): Promise<string | null> {
    return this.connect.getPayoutSchedule(accountId);
  }

  setPayoutInterval(accountId: string, interval: string) {
    return this.connect.setPayoutInterval(accountId, interval);
  }

  createConnectedAccount(email: string, tenant: string) {
    return this.connect.createConnectedAccount(email, tenant);
  }

  createOnboardingLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string,
  ) {
    return this.connect.createOnboardingLink(accountId, returnUrl, refreshUrl);
  }

  connectAccount(req: RequestWithUser) {
    return this.connect.connectAccount(req);
  }
}
