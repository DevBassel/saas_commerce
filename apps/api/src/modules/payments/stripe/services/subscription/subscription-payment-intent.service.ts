import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { toMinorUnit } from 'src/common/utils/money';
import { getTenantContext } from '../../../../auth/tenant-context';
import { BillingInterval } from '../../../../subscriptions/constants/billing-interval.enum';
import { SubscriptionPlan } from '../../../../subscriptions/entities/subscription-plan.entity';
import { subscriptionPaymentMetaData } from '../../../constants/payment-metadata';
import { PaymentStatus } from '../../../constants/payment-status.enum';
import { PaymentsProviders } from '../../../constants/payments-providers';
import { CreateSubDto } from '../../../dto/create-sub.dto';
import { SubscriptionPayment } from '../../../entities/subscription-payment.entity';
import { Subscription } from '../../../entities/subscription.entity';
import { StripeClientService } from '../../stripe-client.service';

@Injectable()
export class SubscriptionPaymentIntentService {
  private readonly logger = new Logger('StripePaymentService');

  constructor(
    private readonly stripeClient: StripeClientService,
    @InjectRepository(SubscriptionPlan)
    private readonly plansRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.client;
  }

  async createSubscriptionPaymentIntent(createSubDto: CreateSubDto) {
    const tenant = getTenantContext()?.tenant;

    if (!tenant) throw new ForbiddenException('Tenant context is required');

    const plan = await this.plansRepo.findOneBy({
      id: createSubDto.planId,
    });

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

    const minorAmount = toMinorUnit(amount);

    if (minorAmount <= 0)
      throw new BadRequestException('Invalid subscription amount');

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
      tenantId: tenant.id,
      planId: plan.id,
      billingInterval,
      tenant: tenant.schemaName,
      subscriptionId: subscription.id,
    };

    return this.subscriptionRepo.manager.transaction(async (manager) => {
      const subscription = await manager.findOne(Subscription, {
        where: { tenantId: tenant.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!subscription)
        throw new NotFoundException({
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found',
        });

      const existingPayment = await manager.findOne(SubscriptionPayment, {
        where: {
          subscriptionId: subscription.id,
          provider: PaymentsProviders.STRIPE,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (existingPayment?.paymentRef) {
        const existingIntent = await this.stripe.paymentIntents.retrieve(
          existingPayment.paymentRef,
        );

        if (existingIntent.status === 'succeeded')
          throw new ConflictException(
            'Subscription payment has already been completed',
          );

        if (
          [
            'requires_payment_method',
            'requires_confirmation',
            'requires_action',
            'processing',
          ].includes(existingIntent.status)
        ) {
          return {
            clientSecret: existingIntent.client_secret,
          };
        }

        if (existingIntent.status === 'canceled')
          throw new ConflictException(
            'Previous subscription payment attempt was canceled. A new payment attempt is required.',
          );
      }

      let intent: Stripe.PaymentIntent;

      try {
        intent = await this.stripe.paymentIntents.create(
          {
            amount: minorAmount,
            currency: plan.currency,
            payment_method_types: ['card'],
            metadata: {
              data: JSON.stringify({
                ...metadata,
                subscriptionId: subscription.id,
              }),
            },
          },
          {
            idempotencyKey:
              `tenant:${tenant.id}:subscription:${subscription.id}:` +
              `plan:${plan.id}:${billingInterval}:payment:v1`,
          },
        );
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

      const payment = manager.create(SubscriptionPayment, {
        subscriptionId: subscription.id,
        planId: plan.id,
        billingInterval,
        provider: PaymentsProviders.STRIPE,
        status: PaymentStatus.PENDING,
        amount,
        currency: plan.currency,
        paymentRef: intent.id,
      });

      await manager.save(SubscriptionPayment, payment);

      return {
        clientSecret: intent.client_secret,
      };
    });
  }
}
