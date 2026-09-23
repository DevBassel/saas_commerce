import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { UserPermissionKey } from 'src/modules/users/constants/user-permissions.enum';
import { RbacPermissionKey } from './rbac-permissions.enum';
import { ProductPermissionKey } from 'src/modules/products/constants/product-permissions.enum';
import { CategoryPermissionKey } from 'src/modules/categories/constants/category-permissions.enum';
import { CartPermissionKey } from 'src/modules/cart/constants/cart-permissions.enum';
import { OrderPermissionKey } from 'src/modules/orders/constants/order-permissions.enum';
import { PaymentPermissionKey } from 'src/modules/payments/constants/payments-permissions.enum';
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

  it('grants CUSTOMER the cart permissions', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.CUSTOMER];
    expect(grants).toContain(CartPermissionKey.READ);
    expect(grants).toContain(CartPermissionKey.CREATE);
    expect(grants).toContain(CartPermissionKey.UPDATE);
    expect(grants).toContain(CartPermissionKey.DELETE);
  });

  it('gives ADMIN full cart access', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.ADMIN];
    expect(grants).toContain(CartPermissionKey.READ);
    expect(grants).toContain(CartPermissionKey.CREATE);
    expect(grants).toContain(CartPermissionKey.UPDATE);
    expect(grants).toContain(CartPermissionKey.DELETE);
  });

  it('gives ADMIN full category access', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.ADMIN];
    expect(grants).toContain(CategoryPermissionKey.READ);
    expect(grants).toContain(CategoryPermissionKey.CREATE);
    expect(grants).toContain(CategoryPermissionKey.UPDATE);
    expect(grants).toContain(CategoryPermissionKey.DELETE);
  });

  it('gives ADMIN full product access', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.ADMIN];
    expect(grants).toContain(ProductPermissionKey.READ);
    expect(grants).toContain(ProductPermissionKey.CREATE);
    expect(grants).toContain(ProductPermissionKey.UPDATE);
    expect(grants).toContain(ProductPermissionKey.DELETE);
  });

  it('does not grant ADMIN destructive RBAC permissions', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.ADMIN];
    expect(grants).not.toContain(RbacPermissionKey.ROLES_DELETE);
    expect(grants).not.toContain(RbacPermissionKey.PERMISSIONS_DELETE);
    expect(grants).toContain(UserPermissionKey.ASSIGN_ROLE);
  });

  it('grants CUSTOMER payment create and read only', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.CUSTOMER];
    expect(grants).toContain(PaymentPermissionKey.CREATE);
    expect(grants).toContain(PaymentPermissionKey.READ);
    expect(grants).not.toContain(PaymentPermissionKey.MANAGE);
  });

  it('grants ADMIN full payment access', () => {
    const grants = SEED_ROLE_PERMISSIONS[RoleKey.ADMIN];
    expect(grants).toContain(PaymentPermissionKey.CREATE);
    expect(grants).toContain(PaymentPermissionKey.READ);
    expect(grants).toContain(PaymentPermissionKey.MANAGE);
  });

  it('grants CUSTOMER and ADMIN permission to return orders', () => {
    expect(SEED_ROLE_PERMISSIONS[RoleKey.CUSTOMER]).toContain(
      OrderPermissionKey.RETURN,
    );
    expect(SEED_ROLE_PERMISSIONS[RoleKey.ADMIN]).toContain(
      OrderPermissionKey.RETURN,
    );
  });
});
