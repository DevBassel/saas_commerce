import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IENV, IStripe } from 'src/common/config/env.interface';

@Injectable()
export class StripeClientService {
  readonly client: Stripe;

  constructor(config: ConfigService<IENV>) {
    const { secretKey } = config.getOrThrow<IStripe>('stripe');
    this.client = new Stripe(secretKey);
  }
}
