import { Request } from 'express';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';

export type RequestWithUser = Request & {
  user: {
    id: number;
    name: string;
    email: string;
    role: { id: number; key: RoleKey } | null;
    permissions: PermissionKey[];
  };
};
