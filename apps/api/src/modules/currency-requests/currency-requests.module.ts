import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../tenants/tenant.module';
import { CurrencyChangeRequest } from './entities/currency-change-request.entity';
import { CurrencyRequestsService } from './currency-requests.service';
import { StoreCurrencyController } from './store-currency.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CurrencyChangeRequest]), TenantModule],
  controllers: [StoreCurrencyController],
  providers: [CurrencyRequestsService],
  exports: [CurrencyRequestsService],
})
export class CurrencyRequestsModule {}
