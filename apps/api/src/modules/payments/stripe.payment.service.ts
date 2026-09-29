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
import { IENV, IStripe } from 'src/common/config/env.interface';
import { TenantRef } from '../tenants/tenant.utils';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { PaymentStatus } from './constants/payment-status.enum';
import { PaymentsProviders } from './constants/payments-providers';
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
}
