import type { Permission } from "./permission";

export interface Role {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  permissions?: Permission[];
  createdAt?: string;
  updatedAt?: string;
}
