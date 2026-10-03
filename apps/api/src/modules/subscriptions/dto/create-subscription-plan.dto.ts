import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  SLUG_MESSAGE,
  SLUG_REGEX,
} from 'src/modules/tenants/utils/tenant.utils';
import { LimitValueType } from '../constants/limit-value-type.enum';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';

export class SubscriptionPlanLimitDto {
  @IsEnum(SubscriptionLimitKey)
  key: SubscriptionLimitKey;

  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number | null;

  @IsEnum(LimitValueType)
  type: LimitValueType;
}

export class SubscriptionPlanFeatureDto {
  @IsEnum(SubscriptionFeatureKey)
  key: SubscriptionFeatureKey;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateSubscriptionPlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  @MaxLength(80)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  yearlyPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionPlanLimitDto)
  limits?: SubscriptionPlanLimitDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionPlanFeatureDto)
  features?: SubscriptionPlanFeatureDto[];
}
