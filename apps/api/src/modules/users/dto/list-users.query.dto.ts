import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination.dto';

/**
 * List query for `GET /users`. `role` filters by role key (the admin console's
 * Admins/Customers tabs pass it), and the inherited pagination fields drive the
 * server-side page.
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;
}
