import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../dto/jwt-payload.dto';
import { UsersService } from 'src/modules/users/users.service';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { Permission } from 'src/modules/rbac/entities/permission.entity';
import { RoleKey } from 'src/common/constants/RoleKey.enum';

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = this.jwt.verify<JwtPayload>(token);

      if (payload.type !== 'access') throw new UnauthorizedException();
      const user = await this.userService.findOne(
        { id: payload.id },
        { withRole: true },
      );
      if (!user) throw new NotFoundException('User not found');

      request.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
          ? { id: user.role.id, key: String(user.role.key) as RoleKey }
          : null,
        permissions: (user.role?.permissions as Permission[])?.map(
          (p) => p.key as PermissionKey,
        ),
      };
    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }
}
