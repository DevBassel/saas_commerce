import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { IS_PLATFORM } from '../decorators/isPlatform.decorator';
import { TenantResolutionService } from 'src/modules/tenants/services/tenant-resolution.service';
import { TenantStatus } from 'src/modules/tenants/enums/tenantStatus.enum';

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

    if (tenant.status === TenantStatus.INACTIVE)
      throw new ForbiddenException(
        'Tenant is inactive or suspended. Please contact the administrator.',
      );

    request.tenant = tenant;
    return true;
  }
}
