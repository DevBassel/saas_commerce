import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @IsString()
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_-]*$/, {
    message:
      'key must start with a lowercase letter and contain only lowercase letters, digits, underscores or hyphens',
  })
  key?: string;
}
