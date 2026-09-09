export enum RoleKey {
  SUPER_ADMIN = 'SUPER_ADMIN',
  STORE_OWNER = 'STORE_OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  CUSTOMER = 'CUSTOMER',
}

export const ROLE_RANK: Record<RoleKey, number> = {
  [RoleKey.SUPER_ADMIN]: 5,
  [RoleKey.STORE_OWNER]: 4,
  [RoleKey.ADMIN]: 3,
  [RoleKey.MANAGER]: 2,
  [RoleKey.EMPLOYEE]: 1,
  [RoleKey.CUSTOMER]: 0,
};
