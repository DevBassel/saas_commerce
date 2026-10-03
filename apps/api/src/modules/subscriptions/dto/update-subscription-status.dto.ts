import { IsEnum } from 'class-validator';
import { SubscriptionStatus } from '../constants/subscription-status.enum';

export class UpdateSubscriptionStatusDto {
  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;
}
