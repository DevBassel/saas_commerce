import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  COUPON_CODE_MESSAGE,
  COUPON_CODE_REGEX,
  MAX_COUPON_CODE_LENGTH,
  normalizeCouponCodeValue,
} from '../constants/coupon.constants';

export class ValidateCouponDto {
  @Transform(({ value }) => normalizeCouponCodeValue(value))
  @IsString()
  @Matches(COUPON_CODE_REGEX, { message: COUPON_CODE_MESSAGE })
  @MaxLength(MAX_COUPON_CODE_LENGTH)
  code: string;
}
