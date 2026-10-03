import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  COUPON_CODE_MESSAGE,
  COUPON_CODE_REGEX,
  MAX_COUPON_CODE_LENGTH,
  normalizeCouponCodeValue,
} from '../../coupons/constants/coupon.constants';

export class CheckoutDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  addressId?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeCouponCodeValue(value))
  @IsString()
  @Matches(COUPON_CODE_REGEX, { message: COUPON_CODE_MESSAGE })
  @MaxLength(MAX_COUPON_CODE_LENGTH)
  couponCode?: string;
}
