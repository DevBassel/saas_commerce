import { IsEmail, IsEnum } from 'class-validator';
import { OtpPurpose } from '../constants/otp-purpose.enum';

export class RequestOtpDto {
  @IsEmail()
  email: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}
