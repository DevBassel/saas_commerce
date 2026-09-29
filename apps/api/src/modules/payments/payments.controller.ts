import {
  Body,
  Controller,
  Headers,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import StripePaymentService from './stripe.payment.service';
import type { Request } from 'express';

@Controller('payments')
export default class PaymentsController {
  constructor(private readonly stripePaymentService: StripePaymentService) {}
  @Post('stripe')
  createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.stripePaymentService.createPayment(createPaymentDto);
  }

  @Post('/stripe/webhook')
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.stripePaymentService.webHook(req, sig);
  }
}
