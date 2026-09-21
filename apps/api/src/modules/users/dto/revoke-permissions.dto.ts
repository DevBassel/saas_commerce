import { IsArray, IsInt, IsOptional, IsPositive } from 'class-validator';

export class RevokePermissionsDto {
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @IsOptional()
  permissionIds?: number[];
}
