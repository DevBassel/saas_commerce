import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { RbacPermissionKey } from 'src/modules/rbac/constants/rbac-permissions.enum';
import { ProductPermissionKey } from 'src/modules/products/constants/product-permissions.enum';
import { CategoryPermissionKey } from 'src/modules/categories/constants/category-permissions.enum';

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
  {
    key: ProductPermissionKey.READ,
    name: 'Read products',
    description: 'List and view store products',
  },
  {
    key: ProductPermissionKey.CREATE,
    name: 'Create products',
    description: 'Add new products',
  },
  {
    key: ProductPermissionKey.UPDATE,
    name: 'Update products',
    description: 'Edit products and manage their images',
  },
  {
    key: ProductPermissionKey.DELETE,
    name: 'Delete products',
    description: 'Remove products',
  },
  {
    key: CategoryPermissionKey.READ,
    name: 'Read categories',
    description: 'List and view product categories',
  },
  {
    key: CategoryPermissionKey.CREATE,
    name: 'Create categories',
    description: 'Add new product categories',
  },
  {
    key: CategoryPermissionKey.UPDATE,
    name: 'Update categories',
    description: 'Edit product categories',
  },
  {
    key: CategoryPermissionKey.DELETE,
    name: 'Delete categories',
    description: 'Remove product categories',
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
      'Full store access through explicitly granted permissions. Can assign any role including ADMIN and STORE_OWNER.',
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

const ALL_PERMISSION_KEYS: PermissionKey[] = SEED_PERMISSIONS.map((p) => p.key);

export const SEED_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  [RoleKey.SUPER_ADMIN]: ALL_PERMISSION_KEYS,
  [RoleKey.STORE_OWNER]: ALL_PERMISSION_KEYS,
  [RoleKey.ADMIN]: [
    UserPermissionKey.READ,
    UserPermissionKey.UPDATE,
    UserPermissionKey.DELETE,
    UserPermissionKey.ASSIGN_ROLE,
    UserPermissionKey.ASSIGN_PERMISSIONS,
    RbacPermissionKey.ROLES_READ,
    RbacPermissionKey.PERMISSIONS_READ,
    ProductPermissionKey.READ,
    ProductPermissionKey.CREATE,
    ProductPermissionKey.UPDATE,
    ProductPermissionKey.DELETE,
    CategoryPermissionKey.READ,
    CategoryPermissionKey.CREATE,
    CategoryPermissionKey.UPDATE,
    CategoryPermissionKey.DELETE,
  ],
  [RoleKey.MANAGER]: [
    UserPermissionKey.READ,
    UserPermissionKey.UPDATE,
    RbacPermissionKey.ROLES_READ,
    ProductPermissionKey.READ,
    ProductPermissionKey.UPDATE,
    CategoryPermissionKey.READ,
    CategoryPermissionKey.UPDATE,
  ],
  [RoleKey.EMPLOYEE]: [
    UserPermissionKey.READ,
    ProductPermissionKey.READ,
    CategoryPermissionKey.READ,
  ],
  [RoleKey.CUSTOMER]: [],
};
