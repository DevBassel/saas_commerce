import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RbacPermissionKey } from '../constants/rbac-permissions.enum';

export class CreatePermissionDto {
  @IsEnum(RbacPermissionKey)
  key: RbacPermissionKey;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
