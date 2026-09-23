import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { RbacPermissionKey } from 'src/modules/rbac/constants/rbac-permissions.enum';
import { ProductPermissionKey } from 'src/modules/products/constants/product-permissions.enum';
import { CategoryPermissionKey } from 'src/modules/categories/constants/category-permissions.enum';
import { CartPermissionKey } from 'src/modules/cart/constants/cart-permissions.enum';
import { OrderPermissionKey } from 'src/modules/orders/constants/order-permissions.enum';
import { PaymentPermissionKey } from 'src/modules/payments/constants/payments-permissions.enum';
import { AddressPermissionKey } from 'src/modules/addresses/constants/address-permissions.enum';

export type PermissionKey =
  | UserPermissionKey
  | RbacPermissionKey
  | ProductPermissionKey
  | CategoryPermissionKey
  | CartPermissionKey
  | OrderPermissionKey
  | PaymentPermissionKey
  | AddressPermissionKey;
