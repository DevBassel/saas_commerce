import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SLUG_MESSAGE, SLUG_REGEX } from '../../tenants/tenant.utils';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_REGEX, { message: SLUG_MESSAGE })
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
