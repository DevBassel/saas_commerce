import { IsEmail, IsEnum, IsString, Length } from 'class-validator';
import { RolesType } from 'src/common/constants/Roles.enum';

export class LoginUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 16)
  password: string;

  @IsEnum(RolesType)
  type: RolesType;
}
