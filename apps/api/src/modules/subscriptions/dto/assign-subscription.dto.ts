import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { BillingInterval } from '../constants/billing-interval.enum';

export class AssignSubscriptionDto {
  @IsInt()
  @Min(1)
  planId: number;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;
}
