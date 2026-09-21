import { ArrayNotEmpty, IsArray, IsInt, IsPositive } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  permissionIds: number[];
}
