import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
} from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.dto';
import { PRODUCT_SORTABLE_FIELDS } from '../constants/products-query.constants';

const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

const toQueryNumber = ({ obj, key }: TransformFnParams): number | undefined => {
  const value: unknown = (obj as Record<string, unknown>)[key];
  if (value === undefined || typeof value === 'number') return value;
  if (typeof value !== 'string' || !DECIMAL_NUMBER.test(value.trim())) {
    return Number.NaN;
  }
  return Number(value);
};

@ValidatorConstraint({ name: 'priceRange', async: false })
class PriceRangeConstraint implements ValidatorConstraintInterface {
  validate(maxPrice: unknown, args: ValidationArguments): boolean {
    const { minPrice } = args.object as ListProductsQueryDto;
    // Field validators report malformed bounds; this constraint compares valid numbers.
    return (
      typeof minPrice !== 'number' ||
      !Number.isFinite(minPrice) ||
      typeof maxPrice !== 'number' ||
      !Number.isFinite(maxPrice) ||
      minPrice <= maxPrice
    );
  }

  defaultMessage(): string {
    return 'minPrice must be less than or equal to maxPrice';
  }
}

/**
 * `GET /products` is public and historically returns a plain array. When a
 * client sends `page`/`limit` (the Refine admin console does), the endpoint
 * returns a paginated envelope instead.
 */
export class ListProductsQueryDto extends PaginationQueryDto {
  // Override eager Number coercion while retaining inherited pagination validators.
  @Type(() => Object)
  @Transform(toQueryNumber, { toClassOnly: true })
  declare page?: number;

  @Type(() => Object)
  @Transform(toQueryNumber, { toClassOnly: true })
  declare limit?: number;

  @IsIn(PRODUCT_SORTABLE_FIELDS)
  declare sortBy?: string;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @Transform(toQueryNumber, { toClassOnly: true })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  categoryId?: number;

  @IsOptional()
  @Transform(toQueryNumber, { toClassOnly: true })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(toQueryNumber, { toClassOnly: true })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Validate(PriceRangeConstraint)
  maxPrice?: number;

  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  inStock?: boolean;
}
