import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class RegisterStoreDto extends CreateUserDto {
  @IsString()
  @MinLength(2)
  storeName: string;

  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'storeSlug must be lowercase alphanumeric, hyphen-separated',
  })
  storeSlug: string;

  @IsOptional()
  @IsString()
  subdomain?: string;
}
