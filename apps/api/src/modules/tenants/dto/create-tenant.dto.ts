import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { SLUG_MESSAGE, SLUG_REGEX } from '../tenant.utils';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @Length(2, 50)
  @Matches(SLUG_REGEX, {
    message: `slug ${SLUG_MESSAGE}`,
  })
  slug: string;

  @IsOptional()
  @IsString()
  subdomain?: string;
}
