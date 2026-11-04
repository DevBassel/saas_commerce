import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IENV, IStripe } from 'src/common/config/env.interface';
import { toMajorUnit, toMinorUnit } from 'src/common/utils/money';
import {
  getTenantContext,
  tenantRefFromContext,
} from '../../auth/tenant-context';
import { Order } from '../../orders/entities/order.entity';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import { resolveTenantScope } from '../../tenants/utils/tenant-scope';
import { TenantRef } from '../../tenants/utils/tenant.utils';
import { paymentMetaData } from '../constants/payment-metadata';
import { PaymentStatus } from '../constants/payment-status.enum';
import { PaymentsProviders } from '../constants/payments-providers';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { Payment } from '../entities/payment.entity';
import { StripeClientService } from '../stripe/stripe-client.service';

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger('StripePaymentService');

  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly tenantManager: TenantManagerService,
    private readonly stripeClient: StripeClientService,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.client;
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
    const { orderRepo } = await this.repos();

    const tenant = getTenantContext()?.tenant;
    const tenantSchema = tenantRefFromContext()?.schemaName;

    if (!tenant) throw new BadRequestException('Tenant context is missing');

    if (tenant.paymentsPaused)
      throw new ConflictException('Payments are paused for this store');

    const stripeAccountId = tenant.stripeAccountId;

    if (!stripeAccountId)
      throw new ConflictException('Store is not connected to Stripe');

    return orderRepo.manager.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      const paymentWindow = 24 * 60 * 60 * 1000;

      if (Date.now() - order.createdAt.getTime() > paymentWindow) {
        throw new BadRequestException(
          'Payment window has expired. Orders can only be paid within 24 hours of creation.',
        );
      }

      if (order.paymentStatus === PaymentStatus.PAID)
        throw new ConflictException('Order has already been paid');

      const existingPayment = await manager.findOne(Payment, {
        where: {
          order: { id: order.id },
          provider: PaymentsProviders.STRIPE,
        },
        order: { createdAt: 'DESC' },
      });

      if (existingPayment) {
        const existingIntent = await this.stripe.paymentIntents.retrieve(
          existingPayment.paymentRef,
        );

        if (existingIntent.status === 'succeeded') {
          throw new ConflictException('Order has already been paid');
        }

        if (
          [
            'requires_payment_method',
            'requires_confirmation',
            'requires_action',
            'processing',
          ].includes(existingIntent.status)
        )
          return {
            clientSecret: existingIntent.client_secret,
          };

        if (existingIntent.status === 'canceled')
          throw new ConflictException(
            'Previous payment attempt was canceled. A new payment attempt is required.',
          );
      }

      const amount = toMinorUnit(order.total);

      if (amount <= 0) {
        throw new BadRequestException('Invalid order amount');
      }

      const { applicationFeeBps } = this.config.getOrThrow<IStripe>('stripe');
      const applicationFeeAmount = Math.round(
        (amount * applicationFeeBps) / 10000,
      );

      const params: Stripe.PaymentIntentCreateParams = {
        amount,
        currency: tenant.currency,
        transfer_data: {
          destination: stripeAccountId,
        },
        payment_method_types: ['card'],
        metadata: {
          data: JSON.stringify({
            orderId: order.id,
            userId: order.userId!,
            tenant: tenantSchema,
          }),
        },
      };

      if (applicationFeeAmount > 0) {
        params.application_fee_amount = applicationFeeAmount;
      }

      let paymentIntent: Stripe.PaymentIntent;

      try {
        paymentIntent = await this.stripe.paymentIntents.create(params, {
          idempotencyKey: `order:${order.id}:payment:v1`,
        });
      } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
          this.logger.warn(
            `Stripe payment intent failed: ${error.code ?? error.message}`,
          );
          throw new BadRequestException(
            'Store cannot accept payments right now',
          );
        }

        throw error;
      }

      const payment = manager.create(Payment, {
        order,
        amount: order.total,
        currency: tenant.currency,
        provider: PaymentsProviders.STRIPE,
        status: PaymentStatus.PENDING,
        paymentRef: paymentIntent.id,
      });

      await manager.save(Payment, payment);
      await manager.update(Order, order.id, {
        paymentStatus: PaymentStatus.PENDING,
      });

      return {
        clientSecret: paymentIntent.client_secret,
      };
    });
  }

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

  async successOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    paymentId: string,
  ) {
    const { paymentRepo, orderRepo } = await this.repos({ schemaName: tenant });
    const payment = await paymentRepo.findOne({
      where: { paymentRef: paymentId },
    });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    const order = await orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    await Promise.all([
      paymentRepo.save({
        ...payment,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      }),
      orderRepo.save({
        ...order,
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
      }),
    ]);
  }

  async cancelOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    paymentId: string,
  ) {
    const { paymentRepo, orderRepo } = await this.repos({ schemaName: tenant });
    const payment = await paymentRepo.findOne({
      where: { paymentRef: paymentId },
    });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    const order = await orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    await Promise.all([
      paymentRepo.save({
        ...payment,
        status: PaymentStatus.CANCELED,
        canceledAt: new Date(),
      }),
      orderRepo.save({
        ...order,
        paymentStatus: PaymentStatus.UNPAID,
        canceledAt: new Date(),
      }),
    ]);
  }

  async refundedOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    refund: {
      paymentIntentId: string;
      amountRefunded: number;
      refundReference: string | null;
    },
  ) {
    const { paymentRepo, orderRepo } = await this.repos({ schemaName: tenant });
    const payment = await paymentRepo.findOne({
      where: { paymentRef: refund.paymentIntentId },
    });
    if (!payment)
      throw new NotFoundException(
        `Payment ${refund.paymentIntentId} not found`,
      );
    const order = await orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const refundedAmount = toMajorUnit(refund.amountRefunded);
    const total = Number(payment.amount);
    const status =
      refundedAmount <= 0
        ? PaymentStatus.PAID
        : refundedAmount >= total
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
    const refundedAt =
      refundedAmount > 0 ? (payment.refundedAt ?? new Date()) : null;

    await Promise.all([
      paymentRepo.save({
        ...payment,
        status,
        refundedAmount,
        refundReference:
          refund.refundReference ??
          (refundedAmount > 0 ? payment.refundReference : null),
        refundedAt,
      }),
      orderRepo.save({
        ...order,
        paymentStatus: status,
        refundedAt,
      }),
    ]);
  }

  async failedOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    paymentId: string,
  ) {
    const { paymentRepo, orderRepo } = await this.repos({ schemaName: tenant });
    const payment = await paymentRepo.findOne({
      where: { paymentRef: paymentId },
    });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    const order = await orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    await Promise.all([
      paymentRepo.save({
        ...payment,
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
      }),
      orderRepo.save({
        ...order,
        paymentStatus: PaymentStatus.FAILED,
        failedAt: new Date(),
      }),
    ]);
  }
}
