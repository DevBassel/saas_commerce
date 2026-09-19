import type { Permission } from "./permission";
import type { Role } from "./role";

export interface User {
  id: number;
  name: string;
  email: string;
  emailVerified?: boolean;
  roleId?: number | null;
  role?: Role | null;
  permissions?: Permission[];
  createdAt?: string;
  updatedAt?: string;
}

export type UserRoleSummary = Pick<Role, "id" | "key" | "name">;

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  emailVerified?: boolean;
  roleId?: number | null;
  role?: UserRoleSummary | null;
  permissions?: Array<string | Permission>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActorIdentity {
  id: number;
  name?: string;
  roles?: string[];
}
