import { Request } from 'express';
import { RolesType } from 'src/common/constants/Roles.enum';

export type RequestWithUser = Request & {
  user: {
    id: number;
    name: string;
    email: string;
    role: RolesType;
  };
};
