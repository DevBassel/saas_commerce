import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformTenantsService } from './tenants.service';
import { TenantService } from '../../tenants/tenant.service';
import { IENV } from '../../../common/config/env.interface';

const buildMocks = () => {
  const tenantService = {
    findAll: jest.fn(),
    findByIdWithOwner: jest.fn(),
    toggleActiveTenant: jest.fn(),
    getSchemaSizes: jest.fn(),
  };
  const configMocks = {
    getOrThrow: jest.fn(),
  };
  const service = new PlatformTenantsService(
    tenantService as unknown as TenantService,
    configMocks as unknown as ConfigService<IENV>,
  );

  return { service, tenantService, configMocks };
};

describe('PlatformTenantsService.listTenants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the raw tenants from TenantService.findAll', async () => {
    const { service, tenantService } = buildMocks();
    const rows = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    tenantService.findAll.mockResolvedValue(rows);

    await expect(service.listTenants()).resolves.toBe(rows);
    expect(tenantService.findAll).toHaveBeenCalledTimes(1);
  });
});

describe('PlatformTenantsService.getTenant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the tenant with its owner', async () => {
    const { service, tenantService } = buildMocks();
    const owner = { id: 42, email: 'owner@example.com' };
    tenantService.findByIdWithOwner.mockResolvedValue({
      id: 7,
      name: 'Store',
      slug: 'store',
      owner,
    });

    const result = await service.getTenant(7);

    expect(tenantService.findByIdWithOwner).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      id: 7,
      name: 'Store',
      slug: 'store',
      owner,
    });
  });

  it('keeps a null owner for an ownerless tenant', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findByIdWithOwner.mockResolvedValue({
      id: 7,
      name: 'Store',
      owner: null,
    });

    const result = await service.getTenant(7);

    expect(result.owner).toBeNull();
  });

  it('propagates NotFoundException when the tenant does not exist', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findByIdWithOwner.mockRejectedValue(
      new NotFoundException('Tenant not found'),
    );

    await expect(service.getTenant(99)).rejects.toThrow(NotFoundException);
  });

  it('does not consult getSchemaSizes; returns the raw tenant rows', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findByIdWithOwner.mockResolvedValue({
      id: 7,
      storageUsedBytes: 100n,
      storageCapacityBytes: 1000n,
      owner: null,
    });

    const result = await service.getTenant(7);

    expect(tenantService.getSchemaSizes).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      storageUsedBytes: 100n,
      storageCapacityBytes: 1000n,
    });
  });
});

describe('PlatformTenantsService.toggleActiveTenant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to TenantService and returns its message', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.toggleActiveTenant.mockResolvedValue(
      'Tenant deactivated successfully',
    );

    await expect(service.toggleActiveTenant(7)).resolves.toBe(
      'Tenant deactivated successfully',
    );
    expect(tenantService.toggleActiveTenant).toHaveBeenCalledWith(7);
  });

  it('propagates NotFoundException when the tenant does not exist', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.toggleActiveTenant.mockRejectedValue(
      new NotFoundException('Tenant not found'),
    );

    await expect(service.toggleActiveTenant(99)).rejects.toThrow(
      NotFoundException,
    );
  });
});
