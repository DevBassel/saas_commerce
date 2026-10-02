import { Tenant } from '../tenants/entities/tenant.entity';
import {
  getTenantContext,
  tenantRefFromContext,
  tenantStorage,
  TenantContext,
} from './tenant-context';

const context = (schemaName: string): TenantContext => ({
  tenant: { id: 1, schemaName } as Tenant,
  tenantSchema: schemaName,
});

describe('tenant-context', () => {
  it('returns undefined outside of an ALS store', () => {
    expect(getTenantContext()).toBeUndefined();
    expect(tenantRefFromContext()).toBeUndefined();
  });

  it('exposes the full context inside the store', () => {
    const ctx = context('tenant_acme');

    const result = tenantStorage.run(ctx, () => ({
      full: getTenantContext(),
      ref: tenantRefFromContext(),
    }));

    expect(result.full).toBe(ctx);
    expect(result.ref).toEqual({ schemaName: 'tenant_acme' });
  });

  it('keeps contexts isolated per async run', () => {
    const a = context('tenant_a');
    const b = context('tenant_b');

    const refA = tenantStorage.run(a, () => tenantRefFromContext());
    const refB = tenantStorage.run(b, () => tenantRefFromContext());

    expect(refA).toEqual({ schemaName: 'tenant_a' });
    expect(refB).toEqual({ schemaName: 'tenant_b' });
  });
});
