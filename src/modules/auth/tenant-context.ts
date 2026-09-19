import { AsyncLocalStorage } from 'async_hooks';
import { Tenant } from '../tenants/entities/tenant.entity';

export interface TenantContext {
  tenant: Tenant;
  tenantSchema: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const getTenantContext = (): TenantContext | undefined =>
  tenantStorage.getStore();

export const tenantRefFromContext = (): { schemaName: string } | undefined => {
  const ctx = tenantStorage.getStore();
  return ctx ? { schemaName: ctx.tenantSchema } : undefined;
};
