import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.dto';
import { MAX_COUPON_CODE_LENGTH } from '../constants/coupon.constants';

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class ListCouponsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_COUPON_CODE_LENGTH)
  code?: string;
}
