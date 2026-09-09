import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { Exclude } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @Exclude()
  password?: string;

  @IsString()
  @IsOptional()
  jti?: string;
}
