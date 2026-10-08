import { IsEmail, IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { OtpPurpose } from '../constants/otp-purpose.enum';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;

  @IsString()
  @Matches(/^[0-9]+$/, { message: 'code must contain only digits' })
  @MaxLength(12)
  code: string;
}
