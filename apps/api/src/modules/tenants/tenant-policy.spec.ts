import { ForbiddenException } from '@nestjs/common';
import { TenantStatus } from './enums/tenantStatus.enum';
import { assertTenantActive, TENANT_INACTIVE_MESSAGE } from './tenant-policy';

describe('assertTenantActive', () => {
  it('allows an ACTIVE tenant', () => {
    expect(() =>
      assertTenantActive({ status: TenantStatus.ACTIVE }),
    ).not.toThrow();
  });

  it('throws ForbiddenException for an INACTIVE tenant with the shared message', () => {
    try {
      assertTenantActive({ status: TenantStatus.INACTIVE });
      fail('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toBe(
        TENANT_INACTIVE_MESSAGE,
      );
    }
  });
});
