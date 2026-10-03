import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  COUPON_CODE_MESSAGE,
  COUPON_CODE_REGEX,
  MAX_COUPON_CODE_LENGTH,
  normalizeCouponCodeValue,
} from '../constants/coupon.constants';
import { DiscountType } from '../constants/discount-type.enum';

export class CreateCouponDto {
  @Transform(({ value }) => normalizeCouponCodeValue(value))
  @IsString()
  @Matches(COUPON_CODE_REGEX, { message: COUPON_CODE_MESSAGE })
  @MaxLength(MAX_COUPON_CODE_LENGTH)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  discountValue: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
