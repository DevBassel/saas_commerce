import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import StripePaymentService from '../src/modules/payments/stripe.payment.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const payments = app.get(StripePaymentService);
  const limit = Number(process.env.STRIPE_WEBHOOK_RECONCILE_LIMIT ?? 100);
  const result = await payments.reconcileWebhookEvents(limit);

  await app.close();
  console.log(JSON.stringify(result));
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
