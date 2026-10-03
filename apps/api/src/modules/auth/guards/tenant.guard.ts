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
import { TenantResolutionService } from 'src/modules/tenants/services/tenant-resolution.service';
import { assertTenantActive } from 'src/modules/tenants/utils/tenant-policy';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPlatform = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPlatform) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!this.tenantResolution.isApiPath(request.originalUrl ?? request.url))
      return true;

    const tenant = request.tenant;

    if (!tenant) {
      const hadIdentifier = this.tenantResolution.hasTenantIdentifier(request);
      if (!hadIdentifier) {
        throw new BadRequestException(
          'Tenant not resolvable: missing x-tenant-id/x-tenant-slug header or subdomain',
        );
      }
      throw new NotFoundException('Tenant not found');
    }

    assertTenantActive(tenant);

    request.tenant = tenant;
    return true;
  }
}
