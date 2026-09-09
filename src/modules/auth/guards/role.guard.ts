import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { Roles } from '../decorators/role.decorator';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic: boolean = this.reflector.getAllAndOverride(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    console.log(
      '🚀 ~ role.guard.ts:18 ~ RoleGuard ~ canActivate ~ isPublic:',
      isPublic,
    );

    if (isPublic) return true;

    const roles = this.reflector.get(Roles, context.getHandler());
    if (!roles) return true;

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    console.log({ roles, user });

    if (user) return roles.includes(user.role);

    throw new ForbiddenException('You are not allowed to access this resource');
  }
}
