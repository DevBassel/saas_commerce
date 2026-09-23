import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { RbacPermissionKey } from 'src/modules/rbac/constants/rbac-permissions.enum';
import { ProductPermissionKey } from 'src/modules/products/constants/product-permissions.enum';
import { CategoryPermissionKey } from 'src/modules/categories/constants/category-permissions.enum';
import { CartPermissionKey } from 'src/modules/cart/constants/cart-permissions.enum';
import { OrderPermissionKey } from 'src/modules/orders/constants/order-permissions.enum';
import { PaymentPermissionKey } from 'src/modules/payments/constants/payments-permissions.enum';
import { AddressPermissionKey } from 'src/modules/addresses/constants/address-permissions.enum';

export const SEED_PERMISSIONS: {
  key: PermissionKey;
  name: string;
  description: string;
}[] = [
  {
    key: UserPermissionKey.CREATE,
    name: 'Create users',
    description: 'Create store users',
  },
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
  {
    key: CartPermissionKey.READ,
    name: 'Read cart',
    description: 'View your own shopping cart',
  },
  {
    key: CartPermissionKey.CREATE,
    name: 'Add to cart',
    description: 'Add products to your own shopping cart',
  },
  {
    key: CartPermissionKey.UPDATE,
    name: 'Update cart',
    description: 'Change quantities in your own shopping cart',
  },
  {
    key: CartPermissionKey.DELETE,
    name: 'Delete from cart',
    description: 'Remove items from or clear your own shopping cart',
  },
  {
    key: OrderPermissionKey.CREATE,
    name: 'Place orders',
    description: 'Check out your own shopping cart into an order',
  },
  {
    key: OrderPermissionKey.READ,
    name: 'Read orders',
    description: 'List and view your own orders',
  },
  {
    key: OrderPermissionKey.CANCEL,
    name: 'Cancel orders',
    description: 'Cancel your own orders while they are pending or confirmed',
  },
  {
    key: OrderPermissionKey.RETURN,
    name: 'Return orders',
    description: 'Request a return for your own delivered orders',
  },
  {
    key: OrderPermissionKey.MANAGE,
    name: 'Manage orders',
    description: 'List, view and progress any store order',
  },
  {
    key: PaymentPermissionKey.CREATE,
    name: 'Pay own orders',
    description: 'Start a payment for your own order',
  },
  {
    key: PaymentPermissionKey.READ,
    name: 'Read own payments',
    description: 'View payment status for your own orders',
  },
  {
    key: PaymentPermissionKey.MANAGE,
    name: 'Manage store payment settings',
    description: 'Connect and manage the store payment account',
  },
  {
    key: AddressPermissionKey.CREATE,
    name: 'Create delivery addresses',
    description: 'Add delivery addresses to your own address book',
  },
  {
    key: AddressPermissionKey.READ,
    name: 'Read delivery addresses',
    description: 'List and view your own delivery addresses',
  },
  {
    key: AddressPermissionKey.UPDATE,
    name: 'Update delivery addresses',
    description: 'Edit and set the default of your own delivery addresses',
  },
  {
    key: AddressPermissionKey.DELETE,
    name: 'Delete delivery addresses',
    description: 'Remove delivery addresses from your own address book',
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
    UserPermissionKey.CREATE,
    UserPermissionKey.READ,
    UserPermissionKey.UPDATE,
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
    CartPermissionKey.READ,
    CartPermissionKey.CREATE,
    CartPermissionKey.UPDATE,
    CartPermissionKey.DELETE,
    OrderPermissionKey.CREATE,
    OrderPermissionKey.READ,
    OrderPermissionKey.CANCEL,
    OrderPermissionKey.RETURN,
    OrderPermissionKey.MANAGE,
    PaymentPermissionKey.CREATE,
    PaymentPermissionKey.READ,
    PaymentPermissionKey.MANAGE,
    AddressPermissionKey.CREATE,
    AddressPermissionKey.READ,
    AddressPermissionKey.UPDATE,
    AddressPermissionKey.DELETE,
  ],
  [RoleKey.CUSTOMER]: [
    ProductPermissionKey.READ,
    CategoryPermissionKey.READ,
    CartPermissionKey.READ,
    CartPermissionKey.CREATE,
    CartPermissionKey.UPDATE,
    CartPermissionKey.DELETE,
    OrderPermissionKey.CREATE,
    OrderPermissionKey.READ,
    OrderPermissionKey.CANCEL,
    OrderPermissionKey.RETURN,
    PaymentPermissionKey.CREATE,
    PaymentPermissionKey.READ,
    AddressPermissionKey.CREATE,
    AddressPermissionKey.READ,
    AddressPermissionKey.UPDATE,
    AddressPermissionKey.DELETE,
  ],
};
