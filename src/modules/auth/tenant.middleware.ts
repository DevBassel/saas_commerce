import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { IAPP, IENV } from 'src/common/config/env.interface';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantService } from '../tenants/tenant.service';
import { resolveSubdomain } from '../tenants/tenant.utils';
import { tenantStorage } from './tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly tenantService: TenantService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const url = req.originalUrl ?? req.url;
    if (!this.isApiPath(url) || this.isPlatformPath(url)) {
      next();
      return;
    }

    const tenant = await this.resolve(req);
    if (!tenant) {
      next();
      return;
    }

    (req as Request & { tenant?: Tenant }).tenant = tenant;
    tenantStorage.run(
      { tenant, tenantSchema: tenant.schemaName },
      () => void next(),
    );
  }

  private async resolve(req: Request): Promise<Tenant | undefined | null> {
    const tenantId = req.headers['x-tenant-id'];
    const tenantSlug = req.headers['x-tenant-slug'];

    if (tenantId) {
      try {
        return await this.tenantService.findById(Number(tenantId));
      } catch {
        return undefined;
      }
    }
    if (tenantSlug) return this.tenantService.findBySlug(String(tenantSlug));

    const { rootDomain } = this.config.getOrThrow<IAPP>('app');
    const subdomain = resolveSubdomain(req.headers.host, rootDomain);
    if (subdomain) return this.tenantService.findBySubdomain(subdomain);

    return undefined;
  }

  private isPlatformPath(url: string): boolean {
    const path = url.split('?')[0];
    return (
      path.includes('/platform') ||
      path.endsWith('/auth/register-store') ||
      path.endsWith('/auth/login/platform')
    );
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
}
