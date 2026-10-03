import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { TenantModule } from '../tenants/tenant.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [TenantModule, CartModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
