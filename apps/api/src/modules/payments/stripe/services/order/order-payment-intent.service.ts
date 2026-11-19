import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { IENV, IStripe } from 'src/common/config/env.interface';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { toMinorUnit } from 'src/common/utils/money';
import { RequestWithUser } from '../../../../auth/interfaces/RequestWithUser.interface';
import {
  getTenantContext,
  tenantRefFromContext,
} from '../../../../auth/tenant-context';
import { OrderPermissionKey } from '../../../../orders/constants/order-permissions.enum';
import { Order } from '../../../../orders/entities/order.entity';
import { PaymentStatus } from '../../../constants/payment-status.enum';
import { PaymentsProviders } from '../../../constants/payments-providers';
import { CreatePaymentDto } from '../../../dto/create-payment.dto';
import { Payment } from '../../../entities/payment.entity';
import { StripeClientService } from '../../stripe-client.service';

@Injectable()
export class OrderPaymentIntentService {
  private readonly logger = new Logger('StripePaymentService');

  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly stripeClient: StripeClientService,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.client;
  }

  async createOrderPaymentIntent(
    orderRepo: Repository<Order>,
    createPaymentDto: CreatePaymentDto,
    user: RequestWithUser['user'],
  ) {
    const { orderId } = createPaymentDto;
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

      if (!order) throw new NotFoundException(`Order ${orderId} not found`);

      const canManage =
        user.permissions?.includes(OrderPermissionKey.MANAGE) ||
        user.role?.key === RoleKey.STORE_OWNER ||
        user.role?.key === RoleKey.SUPER_ADMIN;
      if (!canManage && order.userId !== user.id)
        throw new NotFoundException(`Order ${orderId} not found`);

      const paymentWindow = 24 * 60 * 60 * 1000; // 1 day

      if (Date.now() - order.createdAt.getTime() > paymentWindow)
        throw new BadRequestException(
          'Payment window has expired. Orders can only be paid within 24 hours of creation.',
        );

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

        if (existingIntent.status === 'succeeded')
          throw new ConflictException('Order has already been paid');

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
      if (amount <= 0) throw new BadRequestException('Invalid order amount');

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

      if (applicationFeeAmount > 0)
        params.application_fee_amount = applicationFeeAmount;

      let paymentIntent: Stripe.PaymentIntent;

      try {
        paymentIntent = await this.stripe.paymentIntents.create(params, {
          idempotencyKey: `tenant:${tenant.id}:order:${order.id}:payment:v1`,
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
}
