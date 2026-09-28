import { ForbiddenException } from '@nestjs/common';
import { tenantRefFromPayload } from './tenant-ref.util';

const base = { type: 'access' as const, id: 1, role: 'CUSTOMER' };

describe('tenantRefFromPayload', () => {
  it('returns undefined for a platform token with both claims null', () => {
    expect(
      tenantRefFromPayload({
        ...base,
        tenantId: null,
        tenantSchema: null,
      }),
    ).toBeUndefined();
  });

  it('returns the identity when both claims are present', () => {
    expect(
      tenantRefFromPayload({
        ...base,
        tenantId: 7,
        tenantSchema: 'tenant_acme',
      }),
    ).toEqual({ id: 7, schemaName: 'tenant_acme' });
  });

  it('rejects a token carrying only tenantId', () => {
    expect(() =>
      tenantRefFromPayload({
        ...base,
        tenantId: 7,
        tenantSchema: null,
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects a token carrying only tenantSchema', () => {
    expect(() =>
      tenantRefFromPayload({
        ...base,
        tenantId: null,
        tenantSchema: 'tenant_acme',
      }),
    ).toThrow(ForbiddenException);
  });
});
