import { AsyncLocalStorage } from 'async_hooks';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantRef } from '../tenants/tenant.utils';

export interface TenantContext {
  tenant: Tenant;
  tenantSchema: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const getTenantContext = (): TenantContext | undefined =>
  tenantStorage.getStore();

export const tenantRefFromContext = (): TenantRef | undefined => {
  const ctx = tenantStorage.getStore();
  return ctx ? { schemaName: ctx.tenantSchema } : undefined;
};
