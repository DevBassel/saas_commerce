import { User } from './entities/user.entity';

export interface RoleSummary {
  id: number;
  key: string;
  name: string;
}

export interface PermissionSummary {
  id: number;
  key: string;
  name: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  roleId: number | null;
  role: RoleSummary | null;
  permissions: PermissionSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export function presentUser(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    roleId: user.roleId ?? null,
    role: user.role
      ? { id: user.role.id, key: user.role.key, name: user.role.name }
      : null,
    permissions: (user.permissions ?? [])
      .map((p) => ({ id: p.id, key: p.key, name: p.name }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
