import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { IS_PLATFORM } from '../decorators/isPlatform.decorator';
import { TenantResolutionService } from 'src/modules/tenants/tenant-resolution.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPlatform = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPlatform) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!this.tenantResolution.isApiPath(request.originalUrl ?? request.url))
      return true;

    const tenant =
      request.tenant ??
      (await this.tenantResolution.resolveFromRequest(request));

    if (!tenant) {
      const hadIdentifier = this.tenantResolution.hasTenantIdentifier(request);
      if (!hadIdentifier) {
        throw new BadRequestException(
          'Tenant not resolvable: missing x-tenant-id/x-tenant-slug header or subdomain',
        );
      }
      throw new NotFoundException('Tenant not found');
    }

    request.tenant = tenant;
    return true;
  }
}
