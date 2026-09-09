import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { RbacPermissionKey } from '../constants/rbac-permissions.enum';

const PermissionKeyValues = {
  ...UserPermissionKey,
  ...RbacPermissionKey,
};

export class CreateRoleDto {
  @IsString()
  @MaxLength(50)
  key: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(PermissionKeyValues, { each: true })
  @IsOptional()
  permissionKeys?: PermissionKey[];
}
