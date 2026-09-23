import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PHONE_REGEX = /^[+()\-\s\d]{5,50}$/;
const PHONE_MESSAGE =
  'phone must be 5-50 characters using digits and +()- only';
const COUNTRY_REGEX = /^[A-Za-z]{2}$/;
const COUNTRY_MESSAGE = 'country must be a 2-letter ISO code';

export class CreateAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  recipientName: string;

  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  line2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  postalCode: string;

  @IsString()
  @Matches(COUNTRY_REGEX, { message: COUNTRY_MESSAGE })
  country: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
