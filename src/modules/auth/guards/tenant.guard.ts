import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { TenantService } from 'src/modules/tenants/tenant.service';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { IAPP, IENV } from 'src/common/config/env.interface';
import { IS_PLATFORM } from '../decorators/isPlatform.decorator';
import { resolveSubdomain } from 'src/modules/tenants/tenant.utils';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<IENV>,
    private readonly tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPlatform = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPlatform) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!this.isApiPath(request.originalUrl ?? request.url)) return true;

    const tenant = request.tenant ?? (await this.resolve(request));

    if (!tenant) {
      const hadIdentifier = Boolean(
        request.headers['x-tenant-id'] ||
        request.headers['x-tenant-slug'] ||
        this.resolveSubdomain(request.headers.host),
      );
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

  private async resolve(
    request: RequestWithUser,
  ): Promise<Tenant | undefined | null> {
    const tenantId = request.headers['x-tenant-id'];
    const tenantSlug = request.headers['x-tenant-slug'];

    if (tenantId) {
      try {
        return await this.tenantService.findById(Number(tenantId));
      } catch {
        return undefined;
      }
    }
    if (tenantSlug)
      return (
        (await this.tenantService.findBySlug(String(tenantSlug))) ?? undefined
      );

    const subdomain = this.resolveSubdomain(request.headers.host);
    if (subdomain)
      return (await this.tenantService.findBySubdomain(subdomain)) ?? undefined;

    return undefined;
  }

  private isApiPath(url: string): boolean {
    const { apiPrefix, apiVersion } = this.config.getOrThrow<IAPP>('app');
    const base = `/${apiPrefix}/${apiVersion}`;
    return (
      url === base ||
      url === `${base}/` ||
      url.startsWith(`${base}/`) ||
      url.startsWith(`${base}-json`)
    );
  }

  private resolveSubdomain(host?: string): string | undefined {
    return resolveSubdomain(
      host,
      this.config.getOrThrow<IAPP>('app').rootDomain,
    );
  }
}
