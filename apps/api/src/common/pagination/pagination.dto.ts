import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

export type SortOrderValue = 'asc' | 'desc';

/**
 * Shared list query surface. `page`/`limit`/`sortBy`/`sortOrder` mirror the
 * parameters the Refine data provider sends (`buildListParams`). The effective
 * limit is clamped to {@link MAX_LIMIT} by the pagination helpers rather than
 * rejected, so a client asking for more still gets a bounded page.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['asc', 'desc'])
  sortOrder?: SortOrderValue;
}
