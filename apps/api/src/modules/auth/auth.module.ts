import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { TenantModule } from '../tenants/tenant.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EmailOtpModule } from '../email-otp/email-otp.module';
import { EmailOtpController } from '../email-otp/email-otp.controller';
import { TenantGuard } from './guards/tenant.guard';

@Module({
  imports: [UsersModule, TenantModule, SubscriptionsModule, EmailOtpModule],
  controllers: [AuthController, EmailOtpController],
  providers: [AuthService, TenantGuard],
  exports: [AuthService],
})
export class AuthModule {}
