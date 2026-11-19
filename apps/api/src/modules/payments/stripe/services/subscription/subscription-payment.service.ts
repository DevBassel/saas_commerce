import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { subscriptionPaymentMetaData } from '../../../constants/payment-metadata';
import { CreateSubDto } from '../../../dto/create-sub.dto';
import { SubscriptionPaymentIntentService } from './subscription-payment-intent.service';
import { SubscriptionPaymentStatusService } from './subscription-payment-status.service';
import { SubscriptionRefundService } from './subscription-refund.service';

@Injectable()
export class SubscriptionPaymentService {
  constructor(
    private readonly paymentIntents: SubscriptionPaymentIntentService,
    private readonly paymentStatus: SubscriptionPaymentStatusService,
    private readonly refunds: SubscriptionRefundService,
  ) {}

  createSubscriptionPaymentIntent(createSubDto: CreateSubDto) {
    return this.paymentIntents.createSubscriptionPaymentIntent(createSubDto);
  }

  reconcileRefunds(
    limit = 100,
  ): Promise<{ attempted: number; processed: number; failed: number }> {
    return this.refunds.reconcileRefunds(limit);
  }

  cancelSubscriptionWithRefund(tenantId: number) {
    return this.refunds.cancelSubscriptionWithRefund(tenantId);
  }

  cancelOwnSubscription(tenantId: number) {
    return this.refunds.cancelOwnSubscription(tenantId);
  }

  successSubscriptionPayment(
    meta: subscriptionPaymentMetaData,
    paymentRef: string,
    manager?: EntityManager,
  ) {
    return this.paymentStatus.successSubscriptionPayment(
      meta,
      paymentRef,
      manager,
    );
  }

  cancelSubscriptionPayment(paymentRef: string, manager?: EntityManager) {
    return this.paymentStatus.cancelSubscriptionPayment(paymentRef, manager);
  }

  failedSubscriptionPayment(
    paymentRef: string,
    failureReason: string | null,
    manager?: EntityManager,
  ) {
    return this.paymentStatus.failedSubscriptionPayment(
      paymentRef,
      failureReason,
      manager,
    );
  }

  refundedSubscriptionPayment(
    paymentRef: string,
    refund: {
      amountRefunded: number;
      refundReference: string | null;
      providerStatus?: string | null;
      refundRecordId?: number | null;
    },
    manager?: EntityManager,
  ) {
    return this.refunds.refundedSubscriptionPayment(
      paymentRef,
      refund,
      manager,
    );
  }

  downgradeSubscriptionToFree(subscriptionId: number) {
    return this.paymentStatus.downgradeSubscriptionToFree(subscriptionId);
  }
}
