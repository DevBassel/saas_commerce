import { ForbiddenException } from '@nestjs/common';
import { Tenant } from '../entities/tenant.entity';
import { tenantStorage } from '../../auth/tenant-context';
import { requireTenantContext, resolveTenantScope } from './tenant-scope';
import { TenantRef } from './tenant.utils';

const tenant = {
  id: 1,
  schemaName: 'tenant_acme',
  status: 'ACTIVE',
} as unknown as Tenant;
const explicit: TenantRef = { schemaName: 'tenant_explicit' };

describe('resolveTenantScope', () => {
  it('returns the explicitly passed tenant, ignoring any ALS context', () => {
    const result = tenantStorage.run(
      { tenant, tenantSchema: 'tenant_ctx' },
      () => resolveTenantScope(explicit),
    );

    expect(result).toBe(explicit);
  });

  it('falls back to the ALS context schema', () => {
    const result = tenantStorage.run(
      { tenant, tenantSchema: 'tenant_ctx' },
      () => resolveTenantScope(),
    );

    expect(result).toEqual({ schemaName: 'tenant_ctx' });
  });

  it('throws ForbiddenException when neither explicit nor context is present', () => {
    expect(() => resolveTenantScope()).toThrow(ForbiddenException);
  });

  it('does not treat an empty explicit value as a scope', () => {
    expect(() => resolveTenantScope(undefined)).toThrow(ForbiddenException);
  });
});

describe('requireTenantContext', () => {
  it('returns the full context when present', () => {
    const ctx = { tenant, tenantSchema: 'tenant_ctx' };
    const result = tenantStorage.run(ctx, () => requireTenantContext());
    expect(result).toBe(ctx);
  });

  it('throws ForbiddenException without a context', () => {
    expect(() => requireTenantContext()).toThrow(ForbiddenException);
  });
});
