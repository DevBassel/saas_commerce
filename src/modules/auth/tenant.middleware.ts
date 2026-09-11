import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { tenantStorage } from './tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantResolution: TenantResolutionService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const url = req.originalUrl ?? req.url;
    if (!this.tenantResolution.isApiPath(url)) {
      next();
      return;
    }

    const tenant = await this.tenantResolution.resolveFromRequest(req);
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
}
