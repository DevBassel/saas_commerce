import { ForbiddenException } from '@nestjs/common';
import { getTenantContext, tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from './tenant.utils';

/**
 * Resolves the tenant scope for a service call: an explicitly passed tenant
 * wins, otherwise the request-scoped AsyncLocalStorage context is used. Throws
 * when neither is available.
 *
 * A missing tenant context is an authorization/context problem, so this is a
 * 403 (ForbiddenException), not a 400. All tenant-scoped services must use this
 * helper so the behavior stays consistent.
 */
export const resolveTenantScope = (tenant?: TenantRef): TenantRef => {
  const target = tenant ?? tenantRefFromContext();
  if (!target) throw new ForbiddenException('Tenant context is required');
  return target;
};

/**
 * Returns the full request-scoped tenant context (including the tenant `id`),
 * throwing when the request has no tenant context. Use this when the caller
 * needs more than `schemaName` (e.g. JWT claims).
 */
export const requireTenantContext = () => {
  const ctx = getTenantContext();
  if (!ctx) throw new ForbiddenException('Tenant context is required');
  return ctx;
};
