import { ForbiddenException } from '@nestjs/common';
import { Tenant } from './entities/tenant.entity';
import { TenantStatus } from './enums/tenantStatus.enum';

export const TENANT_INACTIVE_MESSAGE =
  'Tenant is inactive or suspended. Please contact the administrator.';

/**
 * Throws when a tenant is not ACTIVE. Shared by the request-time guard and the
 * token-refresh path so the rule and its message live in exactly one place.
 */
export const assertTenantActive = (tenant: Pick<Tenant, 'status'>): void => {
  if (tenant.status === TenantStatus.INACTIVE)
    throw new ForbiddenException(TENANT_INACTIVE_MESSAGE);
};
