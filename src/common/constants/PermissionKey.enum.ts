import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { RbacPermissionKey } from 'src/modules/rbac/constants/rbac-permissions.enum';
import { ProductPermissionKey } from 'src/modules/products/constants/product-permissions.enum';
import { CategoryPermissionKey } from 'src/modules/categories/constants/category-permissions.enum';

export type PermissionKey =
  | UserPermissionKey
  | RbacPermissionKey
  | ProductPermissionKey
  | CategoryPermissionKey;
