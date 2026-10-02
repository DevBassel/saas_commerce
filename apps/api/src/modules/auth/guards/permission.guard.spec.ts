import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';
import { Roles } from '../decorators/role.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { SEED_ROLE_PERMISSIONS } from 'src/modules/rbac/constants/seed-data';

interface UserShape {
  id: number;
  name: string;
  email: string;
  role: { id: number; key: RoleKey } | null;
  permissions: PermissionKey[];
}

const buildGuard = (
  requiredRoles: RoleKey[] | undefined,
  requiredPermissions: PermissionKey[] | undefined,
  isPublic = false,
): PermissionGuard => {
  const reflector = {
    getAllAndOverride: jest.fn((key: unknown) => {
      if (key === IS_PUBLIC) return isPublic;
      if (key === Roles) return requiredRoles;
      if (key === Permissions) return requiredPermissions;
      return undefined;
    }),
  };
  return new PermissionGuard(reflector as never);
};

const buildContext = (user: UserShape | undefined): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}) as never,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const ownerPermissions = SEED_ROLE_PERMISSIONS[RoleKey.STORE_OWNER];

const owner = (permissions: PermissionKey[]): UserShape => ({
  id: 1,
  name: 'Owner',
  email: 'owner@test.dev',
  role: { id: 1, key: RoleKey.STORE_OWNER },
  permissions,
});

describe('PermissionGuard (C2)', () => {
  it('lets STORE_OWNER through when a seeded grant is present', () => {
    const guard = buildGuard(undefined, [UserPermissionKey.READ]);
    const ctx = buildContext(owner(ownerPermissions));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('does not blanket-bypass STORE_OWNER with no permissions', () => {
    const guard = buildGuard(undefined, [UserPermissionKey.UPDATE]);
    const ctx = buildContext(owner([]));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects a permission the role does not hold', () => {
    const unknown = 'nonexistent:perm' as PermissionKey;
    const guard = buildGuard(undefined, [unknown]);
    const ctx = buildContext(owner(ownerPermissions));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('still allows SUPER_ADMIN unconditionally', () => {
    const guard = buildGuard(
      [RoleKey.SUPER_ADMIN],
      ['nonexistent:perm' as PermissionKey],
    );
    const ctx = buildContext({
      id: 2,
      name: 'Super',
      email: 'super@test.dev',
      role: { id: 99, key: RoleKey.SUPER_ADMIN },
      permissions: [],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('bypasses when @Public even with no authenticated user', () => {
    const guard = buildGuard(undefined, undefined, true);
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('rejects an unauthenticated request when not public', () => {
    const guard = buildGuard(undefined, [UserPermissionKey.READ]);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('requires exact @Roles membership', () => {
    const guard = buildGuard([RoleKey.SUPER_ADMIN], undefined);
    const ctx = buildContext({
      id: 3,
      name: 'Admin',
      email: 'admin@test.dev',
      role: { id: 2, key: RoleKey.ADMIN },
      permissions: ownerPermissions,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows a role listed in @Roles', () => {
    const guard = buildGuard([RoleKey.ADMIN, RoleKey.STORE_OWNER], undefined);
    const ctx = buildContext({
      id: 3,
      name: 'Admin',
      email: 'admin@test.dev',
      role: { id: 2, key: RoleKey.ADMIN },
      permissions: [],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('requires all @Permissions to be held', () => {
    const guard = buildGuard(undefined, [
      UserPermissionKey.READ,
      UserPermissionKey.UPDATE,
    ]);
    const ctx = buildContext(owner([UserPermissionKey.READ]));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows when every @Permissions entry is held', () => {
    const guard = buildGuard(undefined, [
      UserPermissionKey.READ,
      UserPermissionKey.UPDATE,
    ]);
    const ctx = buildContext(
      owner([UserPermissionKey.READ, UserPermissionKey.UPDATE]),
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('lets SUPER_ADMIN bypass a plain @Roles check', () => {
    const guard = buildGuard([RoleKey.ADMIN], undefined);
    const ctx = buildContext({
      id: 2,
      name: 'Super',
      email: 'super@test.dev',
      role: { id: 99, key: RoleKey.SUPER_ADMIN },
      permissions: [],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
