import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { RbacPermissionKey } from 'src/modules/rbac/constants/rbac-permissions.enum';

export const SEED_PERMISSIONS: {
  key: PermissionKey;
  name: string;
  description: string;
}[] = [
  {
    key: UserPermissionKey.READ,
    name: 'Read users',
    description: 'List and view store users',
  },
  {
    key: UserPermissionKey.UPDATE,
    name: 'Update users',
    description: 'Edit users accounts',
  },
  {
    key: UserPermissionKey.DELETE,
    name: 'Delete users',
    description: 'Remove users accounts',
  },
  {
    key: UserPermissionKey.ASSIGN_ROLE,
    name: 'Assign user role',
    description: 'Change role of any user',
  },
  {
    key: UserPermissionKey.ASSIGN_PERMISSIONS,
    name: 'Assign user permissions',
    description: 'Grant direct permissions to any user',
  },
  {
    key: RbacPermissionKey.ROLES_CREATE,
    name: 'Create roles',
    description: 'Create custom roles',
  },
  {
    key: RbacPermissionKey.ROLES_READ,
    name: 'Read roles',
    description: 'List and view roles',
  },
  {
    key: RbacPermissionKey.ROLES_UPDATE,
    name: 'Update roles',
    description: 'Edit roles and their permissions',
  },
  {
    key: RbacPermissionKey.ROLES_DELETE,
    name: 'Delete roles',
    description: 'Remove roles',
  },
  {
    key: RbacPermissionKey.PERMISSIONS_CREATE,
    name: 'Create permissions',
    description: 'Create custom permissions',
  },
  {
    key: RbacPermissionKey.PERMISSIONS_READ,
    name: 'Read permissions',
    description: 'List and view permissions',
  },
  {
    key: RbacPermissionKey.PERMISSIONS_UPDATE,
    name: 'Update permissions',
    description: 'Edit permissions',
  },
  {
    key: RbacPermissionKey.PERMISSIONS_DELETE,
    name: 'Delete permissions',
    description: 'Remove permissions',
  },
];

export const SEED_ROLES: {
  key: RoleKey;
  name: string;
  description: string;
}[] = [
  {
    key: RoleKey.SUPER_ADMIN,
    name: 'Super Admin',
    description:
      'Platform level. Manages all tenants/stores. Bypasses every permission check.',
  },
  {
    key: RoleKey.STORE_OWNER,
    name: 'Store Owner',
    description:
      'Full access. Bypasses every permission check. Can assign any role including ADMIN and STORE_OWNER.',
  },
  {
    key: RoleKey.ADMIN,
    name: 'Admin',
    description: 'Operational access to manage store users',
  },
  {
    key: RoleKey.MANAGER,
    name: 'Manager',
    description: 'Manages customers and employees day to day',
  },
  {
    key: RoleKey.EMPLOYEE,
    name: 'Employee',
    description: 'Store staff with view access to customers',
  },
  {
    key: RoleKey.CUSTOMER,
    name: 'Customer',
    description: 'Default registered customer',
  },
];
