import { AsyncLocalStorage } from 'async_hooks';
import { Tenant } from '../tenants/entities/tenant.entity';

export interface TenantContext {
  tenant: Tenant;
  tenantSchema: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

console.log('🚀 ~ tenant-context.ts:11 ~ tenantStorage:', tenantStorage);

export const getTenantContext = (): TenantContext | undefined =>
  tenantStorage.getStore();

export const tenantRefFromContext = (): { schemaName: string } | undefined => {
  const ctx = tenantStorage.getStore();
  return ctx ? { schemaName: ctx.tenantSchema } : undefined;
};
