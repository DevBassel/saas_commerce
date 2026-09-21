import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import {
  SEED_PERMISSIONS,
  SEED_ROLES,
  SEED_ROLE_PERMISSIONS,
} from './constants/seed-data';
import { RoleKey } from 'src/common/constants/RoleKey.enum';

const logger = new Logger('RbacSeed');

export const TENANT_ROLE_KEYS: RoleKey[] = [
  RoleKey.STORE_OWNER,
  RoleKey.ADMIN,
  RoleKey.CUSTOMER,
];

export interface SeedRbacOptions {
  roles: RoleKey[];
}

export const seedRbac = async (
  ds: DataSource,
  options: SeedRbacOptions,
): Promise<void> => {
  const permissionRepo = ds.getRepository(Permission);
  const roleRepo = ds.getRepository(Role);

  for (const perm of SEED_PERMISSIONS) {
    const entity = await permissionRepo.findOneBy({ key: perm.key });
    if (!entity) {
      await permissionRepo.save(permissionRepo.create(perm));
    }
  }
  logger.log(`Seeded ${SEED_PERMISSIONS.length} permissions`);

  const permissionByKey = new Map(
    (await permissionRepo.find()).map((p) => [p.key, p]),
  );

  for (const key of options.roles) {
    const roleSeed = SEED_ROLES.find((r) => r.key === key);
    if (!roleSeed) continue;

    let role = await roleRepo.findOneBy({ key: roleSeed.key });
    if (!role) {
      role = roleRepo.create({
        key: roleSeed.key,
        name: roleSeed.name,
        description: roleSeed.description,
      });
    } else {
      role.name = roleSeed.name;
      role.description = roleSeed.description;
    }
    role.isSystem = true;

    role.permissions = (SEED_ROLE_PERMISSIONS[roleSeed.key] ?? [])
      .map((permissionKey) => permissionByKey.get(permissionKey))
      .filter((permission): permission is Permission => Boolean(permission));

    await roleRepo.save(role);
  }
  logger.log(`Seeded ${options.roles.length} roles with permissions`);
};
