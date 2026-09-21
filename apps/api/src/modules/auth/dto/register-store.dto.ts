import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { SLUG_MESSAGE, SLUG_REGEX } from '../../tenants/tenant.utils';

export class RegisterStoreDto extends CreateUserDto {
  @IsString()
  @MinLength(2)
  storeName: string;

  @IsString()
  @Length(2, 50)
  @Matches(SLUG_REGEX, {
    message: `storeSlug ${SLUG_MESSAGE}`,
  })
  storeSlug: string;

  @IsOptional()
  @IsString()
  subdomain?: string;
}
