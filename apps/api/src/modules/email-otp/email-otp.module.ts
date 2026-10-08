import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { TenantModule } from '../tenants/tenant.module';
import { EmailOtpService } from './email-otp.service';

@Module({
  imports: [TenantModule, EmailModule],
  providers: [EmailOtpService],
  exports: [EmailOtpService],
})
export class EmailOtpModule {}
