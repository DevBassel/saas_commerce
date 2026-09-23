import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAPP, IENV } from 'src/common/config/env.interface';
import { Tenant } from '../entities/tenant.entity';
import { TenantService } from '../tenant.service';
import { resolveSubdomain } from '../tenant.utils';

interface RequestLike {
  headers: Record<string, unknown>;
}

@Injectable()
export class TenantResolutionService {
  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly tenantService: TenantService,
  ) {}

  isApiPath(url: string): boolean {
    const { apiPrefix, apiVersion } = this.config.getOrThrow<IAPP>('app');
    const base = `/${apiPrefix}/${apiVersion}`;
    return (
      url === base ||
      url === `${base}/` ||
      url.startsWith(`${base}/`) ||
      url.startsWith(`${base}-json`)
    );
  }

  hasTenantIdentifier(req: RequestLike): boolean {
    return Boolean(
      req.headers['x-tenant-id'] ||
      req.headers['x-tenant-slug'] ||
      this.subdomainFromHost(req.headers.host),
    );
  }

  async resolveFromRequest(req: RequestLike): Promise<Tenant | undefined> {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;

    if (tenantId) {
      try {
        return await this.tenantService.findById(Number(tenantId));
      } catch {
        return undefined;
      }
    }
    if (tenantSlug) {
      return (await this.tenantService.findBySlug(tenantSlug)) ?? undefined;
    }

    const subdomain = this.subdomainFromHost(req.headers.host);
    if (subdomain) {
      return (await this.tenantService.findBySubdomain(subdomain)) ?? undefined;
    }

    return undefined;
  }

  private subdomainFromHost(host: unknown): string | undefined {
    return resolveSubdomain(
      host as string | undefined,
      this.config.getOrThrow<IAPP>('app').rootDomain,
    );
  }
}
