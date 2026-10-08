import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^[0-9]+$/, { message: 'code must contain only digits' })
  @MaxLength(12)
  code: string;

  @IsString()
  @Length(8, 16)
  newPassword: string;
}
