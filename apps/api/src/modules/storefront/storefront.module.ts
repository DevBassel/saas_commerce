import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { StorefrontController } from './storefront.controller';

@Module({
  imports: [CategoriesModule],
  controllers: [StorefrontController],
})
export class StorefrontModule {}
