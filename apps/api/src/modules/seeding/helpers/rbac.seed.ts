import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { Role } from 'src/modules/rbac/entities/role.entity';
import { Permission } from 'src/modules/rbac/entities/permission.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  SEED_PERMISSIONS,
  SEED_ROLES,
  SEED_ROLE_PERMISSIONS,
} from 'src/modules/rbac/constants/seed-data';
import { mergePermissions } from 'src/modules/rbac/utils/permission.utils';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { withUniqueRetry } from 'src/common/db/unique-retry';

const logger = new Logger('RbacSeed');

/** Both `DataSource` and the transactional `EntityManager` expose this. */
type RepositoryHost = { getRepository: DataSource['getRepository'] };

export const TENANT_ROLE_KEYS: RoleKey[] = [
  RoleKey.STORE_OWNER,
  RoleKey.ADMIN,
  RoleKey.CUSTOMER,
];

export interface SeedRbacOptions {
  roles: RoleKey[];
}

export interface BootstrapSuperAdminOptions {
  email?: string;
  password?: string;
  name?: string;
  rounds?: number;
}

/** Upserts every seeded permission by its unique `key`. Conflict-safe. */
export const upsertPermissions = async (
  host: RepositoryHost,
  permissions = SEED_PERMISSIONS,
): Promise<void> => {
  const repo = host.getRepository(Permission);
  // Clone rows: TypeORM's upsert writes generated columns back into the passed
  // objects, which would corrupt the shared SEED_PERMISSIONS constant (and later
  // re-emit `id` as an update target).
  await withUniqueRetry(() =>
    repo.upsert(
      permissions.map((permission) => ({ ...permission })),
      ['key'],
    ),
  );
};

/**
 * Upserts the given roles by their unique `key` and replaces each role's
 * permission set with the seeded subset. Only system-owned fields are written.
 */
export const upsertRoles = async (
  host: RepositoryHost,
  roleKeys: RoleKey[],
): Promise<void> => {
  const roleRepo = host.getRepository(Role);
  const permissionRepo = host.getRepository(Permission);

  const seeds = roleKeys
    .map((key) => SEED_ROLES.find((role) => role.key === key))
    .filter((role): role is (typeof SEED_ROLES)[number] => Boolean(role));

  if (seeds.length > 0) {
    await withUniqueRetry(() =>
      roleRepo.upsert(
        seeds.map((seed) => ({
          key: seed.key,
          name: seed.name,
          description: seed.description,
          isSystem: true,
        })),
        ['key'],
      ),
    );
  }

  const permissionByKey = new Map(
    (await permissionRepo.find()).map((permission) => [
      permission.key,
      permission,
    ]),
  );

  for (const seed of seeds) {
    const role = await roleRepo.findOne({
      where: { key: seed.key },
      relations: { permissions: true },
    });
    if (!role) continue;

    role.isSystem = true;
    role.permissions = (SEED_ROLE_PERMISSIONS[seed.key] ?? [])
      .map((permissionKey) => permissionByKey.get(permissionKey))
      .filter((permission): permission is Permission => Boolean(permission));

    await roleRepo.save(role);
  }
};

/**
 * Ensures a platform SUPER_ADMIN user exists. When none exists it promotes the
 * bootstrap email if present, or creates it with a bcrypt hash; an existing
 * user keeps its password and gets the role plus a merge of all permissions.
 * Throws when no super admin exists and the bootstrap env is missing.
 */
export const ensureBootstrapSuperAdmin = async (
  ds: DataSource,
  options: BootstrapSuperAdminOptions,
): Promise<void> => {
  const roleRepo = ds.getRepository(Role);
  const permissionRepo = ds.getRepository(Permission);
  const userRepo = ds.getRepository(User);

  const superAdminRole = await roleRepo.findOneBy({
    key: RoleKey.SUPER_ADMIN,
  });
  if (!superAdminRole) return;

  const existingCount = await userRepo
    .createQueryBuilder('user')
    .leftJoin('user.role', 'role')
    .where('role.key = :key', { key: RoleKey.SUPER_ADMIN })
    .getCount();

  if (existingCount > 0) {
    logger.log(
      `SUPER_ADMIN exists (${existingCount}). Skip bootstrap super admin.`,
    );
    return;
  }

  if (!options.email || !options.password) {
    throw new Error(
      'No SUPER_ADMIN user found and BOOTSTRAP_SUPER_ADMIN_EMAIL / BOOTSTRAP_SUPER_ADMIN_PASSWORD are not set. Refusing to boot without a platform super admin.',
    );
  }

  const permissions = await permissionRepo.find();
  const existing = await userRepo.findOneBy({ email: options.email });

  if (existing) {
    await userRepo.update({ id: existing.id }, { roleId: superAdminRole.id });

    const loaded = await userRepo.findOne({
      where: { id: existing.id },
      relations: { permissions: true },
    });
    if (loaded) {
      loaded.permissions = mergePermissions(loaded.permissions, permissions);
      await userRepo.save(loaded);
    }

    logger.log(
      `Granted SUPER_ADMIN role and ${permissions.length} permissions to existing user ${options.email}`,
    );
    return;
  }

  const password = await bcrypt.hash(options.password, options.rounds || 12);
  const created = await userRepo.save(
    userRepo.create({
      name: options.name ?? 'Super Admin',
      email: options.email,
      password,
      emailVerified: true,
      roleId: superAdminRole.id,
      permissions,
    }),
  );

  logger.log(
    `Created bootstrap SUPER_ADMIN ${created.email} with ${permissions.length} permissions`,
  );
};

/**
 * Composition used by tenant provisioning: upserts every seeded permission on
 * the given schema and then the requested tenant roles.
 */
export const seedRbac = async (
  ds: DataSource,
  options: SeedRbacOptions,
): Promise<void> => {
  await upsertPermissions(ds);
  logger.log(`Seeded ${SEED_PERMISSIONS.length} permissions`);

  await upsertRoles(ds, options.roles);
  logger.log(`Seeded ${options.roles.length} roles with permissions`);
};
