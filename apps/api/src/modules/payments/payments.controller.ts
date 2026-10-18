import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateSubDto } from './dto/create-sub.dto';
import StripePaymentService from './stripe.payment.service';
import type { Request } from 'express';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';
import { Public } from '../auth/decorators/isPublic.decorator';
import { Platform } from '../auth/decorators/isPlatform.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PaymentPermissionKey } from './constants/payments-permissions.enum';
import { SubscriptionPermissionKey } from '../subscriptions/constants/subscription-permissions.enum';

@Controller('payments')
export default class PaymentsController {
  constructor(private readonly stripePaymentService: StripePaymentService) {}
  @Post('stripe')
  createOrderPaymentIntent(@Body() createPaymentDto: CreatePaymentDto) {
    return this.stripePaymentService.createOrderPaymentIntent(createPaymentDto);
  }

  @Post('/stripe/subscription')
  @Permissions([SubscriptionPermissionKey.MANAGE])
  createSubscriptionPaymentIntent(@Body() createSubDto: CreateSubDto) {
    return this.stripePaymentService.createSubscriptionPaymentIntent(
      createSubDto,
    );
  }

  @Post('/stripe/subscription/cancel')
  @Permissions([SubscriptionPermissionKey.MANAGE])
  cancelSubscription(@Req() req: RequestWithUser) {
    const tenant = req.tenant;
    if (!tenant) throw new ForbiddenException('Tenant context is required');
    return this.stripePaymentService.cancelOwnSubscription(tenant.id);
  }

  @Platform()
  @Public()
  @Post('/stripe/webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.stripePaymentService.webHook(req, sig);
  }

  @Get('/stripe/account')
  @Permissions([PaymentPermissionKey.MANAGE])
  getAccount(@Req() req: RequestWithUser) {
    return this.stripePaymentService.getAccountStatus(req.tenant!);
  }

  @Post('/stripe/connect')
  @Permissions([PaymentPermissionKey.MANAGE])
  connect(@Req() req: RequestWithUser) {
    return this.stripePaymentService.connectAccount(req);
  }
}
