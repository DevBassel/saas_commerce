import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { TenantModule } from '../tenants/tenant.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantGuard } from './guards/tenant.guard';

@Module({
  imports: [UsersModule, TenantModule, SubscriptionsModule],
  controllers: [AuthController],
  providers: [AuthService, TenantGuard],
  exports: [AuthService],
})
export class AuthModule {}
