import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { Roles } from '../decorators/role.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';
import { RoleKey } from 'src/common/constants/RoleKey.enum';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) throw new ForbiddenException('User not authenticated');

    const requiredRoles = this.reflector.getAllAndOverride(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiresSuper = requiredRoles?.includes(RoleKey.SUPER_ADMIN);
    const isSuper = user.role?.key === RoleKey.SUPER_ADMIN;
    if (requiresSuper && !isSuper)
      throw new ForbiddenException(
        'You are not allowed to access this resource',
      );

    if (isSuper) return true;

    if (requiredRoles?.length) {
      const roleOk = requiredRoles.includes(user.role?.key as RoleKey);
      if (!roleOk)
        throw new ForbiddenException(
          'You are not allowed to access this resource',
        );
    }

    const requiredPermissions = this.reflector.getAllAndOverride(Permissions, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredPermissions?.length) {
      const owned = new Set(user.permissions);
      const permOk = requiredPermissions.every((p) => owned.has(p));
      if (!permOk)
        throw new ForbiddenException(
          'You are not allowed to access this resource',
        );
    }

    return true;
  }
}
