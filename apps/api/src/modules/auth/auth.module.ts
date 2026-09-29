import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { TenantModule } from '../tenants/tenant.module';
import { TenantGuard } from './guards/tenant.guard';
import StripePaymentService from '../payments/stripe.payment.service';
import PaymentService from '../payments/payments.service';

@Module({
  imports: [UsersModule, TenantModule],
  controllers: [AuthController],
  providers: [AuthService, TenantGuard, StripePaymentService, PaymentService],
  exports: [AuthService],
})
export class AuthModule {}
