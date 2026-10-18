import { IsNumber, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';

export class CreateSubDto {
  @IsNumber()
  @IsNotEmpty()
  planId: number;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;
}
