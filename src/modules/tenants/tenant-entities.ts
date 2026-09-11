import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { User } from '../users/entities/user.entity';
import { Role } from '../rbac/entities/role.entity';
import { Permission } from '../rbac/entities/permission.entity';

export const TENANT_ENTITIES: PostgresConnectionOptions['entities'] = [
  User,
  Role,
  Permission,
];
