import { IsIn, IsOptional } from 'class-validator';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { RoleKey } from '../../../../common/constants/RoleKey.enum';

export class PlatformCreateUserDto extends CreateUserDto {
  @IsOptional()
  @IsIn([RoleKey.CUSTOMER, RoleKey.STORE_OWNER])
  roleKey?: RoleKey;
}
