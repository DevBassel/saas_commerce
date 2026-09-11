import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IS_PUBLIC } from '../decorators/isPublic.decorator';
import { IS_PLATFORM } from '../decorators/isPlatform.decorator';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../dto/jwt-payload.dto';
import { UsersService } from 'src/modules/users/users.service';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { getTenantContext } from '../tenant-context';
import { IENV, IJWT } from 'src/common/config/env.interface';
import { tenantRefFromPayload } from '../tenant-ref.util';

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly userService: UsersService,
    private readonly config: ConfigService<IENV>,
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

    const { accessSecret, issuer, audience } =
      this.config.getOrThrow<IJWT>('jwt');

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token, {
        secret: accessSecret,
        issuer,
        audience,
      });
    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new UnauthorizedException('Invalid token');
    }

    if (payload.type !== 'access') throw new UnauthorizedException();

    const isPlatform = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM, [
      context.getHandler(),
      context.getClass(),
    ]);
    const tenant = tenantRefFromPayload(payload);
    const resolved = request.tenant ?? getTenantContext()?.tenant;

    if (isPlatform) {
      if (tenant) {
        throw new ForbiddenException(
          'Platform routes require a platform token',
        );
      }
    } else {
      if (!tenant) throw new ForbiddenException('Tenant-scoped token required');
      if (!resolved) throw new ForbiddenException('Tenant context is required');
      if (resolved.schemaName !== tenant.schemaName)
        throw new ForbiddenException('Token does not belong to this tenant');
    }
    const user = await this.userService.findOne(
      { id: payload.id },
      { withRole: true, withPermissions: true },
      tenant,
    );
    if (!user) throw new NotFoundException('User not found');

    const directPermissions =
      user.permissions?.map((p) => p.key as PermissionKey) ?? [];
    const rolePermissions =
      user.role?.permissions?.map((p) => p.key as PermissionKey) ?? [];
    const permissions = [
      ...new Set([...directPermissions, ...rolePermissions]),
    ];

    request.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
        ? { id: user.role.id, key: String(user.role.key) as RoleKey }
        : null,
      permissions,
    };

    if (tenant) request.tenant = resolved ?? request.tenant;

    return true;
  }
}
