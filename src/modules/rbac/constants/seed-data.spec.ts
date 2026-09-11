import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { RbacPermissionKey } from './rbac-permissions.enum';
import { SEED_PERMISSIONS, SEED_ROLE_PERMISSIONS } from './seed-data';

describe('role × permission seed matrix', () => {
  const knownKeys = new Set(SEED_PERMISSIONS.map((p) => p.key));

  it('only references permissions that are seeded', () => {
    for (const keys of Object.values(SEED_ROLE_PERMISSIONS)) {
      for (const key of keys) {
        expect(knownKeys.has(key)).toBe(true);
      }
    }
  });

  it('grants STORE_OWNER every seeded permission', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.STORE_OWNER];
    expect(new Set(grants).size).toBe(SEED_PERMISSIONS.length);
  });

  it('grants CUSTOMER nothing', () => {
    expect(SEED_ROLE_PERMISSIONS[RoleKey.CUSTOMER]).toEqual([]);
  });

  it('gives EMPLOYEE read-only user access', () => {
    expect(SEED_ROLE_PERMISSIONS[RoleKey.EMPLOYEE]).toEqual([
      UserPermissionKey.READ,
    ]);
  });

  it('does not grant ADMIN destructive RBAC permissions', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.ADMIN];
    expect(grants).not.toContain(RbacPermissionKey.ROLES_DELETE);
    expect(grants).not.toContain(RbacPermissionKey.PERMISSIONS_DELETE);
    expect(grants).toContain(UserPermissionKey.ASSIGN_ROLE);
  });

  it('gives MANAGER customer/employee management without RBAC writes', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.MANAGER];
    expect(grants).toContain(UserPermissionKey.READ);
    expect(grants).toContain(UserPermissionKey.UPDATE);
    expect(grants).not.toContain(UserPermissionKey.DELETE);
    expect(grants).not.toContain(RbacPermissionKey.ROLES_CREATE);
  });
});
