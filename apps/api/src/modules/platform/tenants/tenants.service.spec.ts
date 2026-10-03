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
    getSchemaSizes: jest.fn().mockResolvedValue(new Map()),
    getSchemaCapacityBytes: jest.fn().mockReturnValue(5000),
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

  it('returns tenants with their schema sizes', async () => {
    const { service, tenantService } = buildMocks();
    const rows = [
      { id: 1, name: 'A', schemaName: 'tenant_a' },
      { id: 2, name: 'B', schemaName: 'tenant_b' },
    ];
    tenantService.findAll.mockResolvedValue(rows);
    tenantService.getSchemaSizes.mockResolvedValue(
      new Map([
        ['tenant_a', 1024],
        ['tenant_b', 2048],
      ]),
    );

    await expect(service.listTenants()).resolves.toEqual([
      {
        id: 1,
        name: 'A',
        schemaName: 'tenant_a',
        schemaSizeBytes: 1024,
        schemaCapacityBytes: 5000,
      },
      {
        id: 2,
        name: 'B',
        schemaName: 'tenant_b',
        schemaSizeBytes: 2048,
        schemaCapacityBytes: 5000,
      },
    ]);
    expect(tenantService.findAll).toHaveBeenCalledTimes(1);
    expect(tenantService.getSchemaSizes).toHaveBeenCalledWith([
      'tenant_a',
      'tenant_b',
    ]);
  });

  it('reports zero when a tenant schema is missing from the size result', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findAll.mockResolvedValue([
      { id: 1, name: 'A', schemaName: 'tenant_a' },
    ]);
    tenantService.getSchemaSizes.mockResolvedValue(new Map());

    await expect(service.listTenants()).resolves.toEqual([
      {
        id: 1,
        name: 'A',
        schemaName: 'tenant_a',
        schemaSizeBytes: 0,
        schemaCapacityBytes: 5000,
      },
    ]);
  });

  it('falls back to zero schema size when the size query fails', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findAll.mockResolvedValue([
      { id: 1, name: 'A', schemaName: 'tenant_a' },
    ]);
    tenantService.getSchemaSizes.mockRejectedValue(new Error('pg down'));

    await expect(service.listTenants()).resolves.toEqual([
      {
        id: 1,
        name: 'A',
        schemaName: 'tenant_a',
        schemaSizeBytes: 0,
        schemaCapacityBytes: 5000,
      },
    ]);
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
      schemaSizeBytes: 0,
      schemaCapacityBytes: 5000,
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

  it('includes the schema size for the tenant schema', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findByIdWithOwner.mockResolvedValue({
      id: 7,
      schemaName: 'tenant_store',
      storageUsedBytes: 100n,
      storageCapacityBytes: 1000n,
      owner: null,
    });
    tenantService.getSchemaSizes.mockResolvedValue(
      new Map([['tenant_store', 4096]]),
    );

    const result = await service.getTenant(7);

    expect(tenantService.getSchemaSizes).toHaveBeenCalledWith(['tenant_store']);
    expect(result).toMatchObject({
      storageUsedBytes: 100n,
      storageCapacityBytes: 1000n,
      schemaSizeBytes: 4096,
      schemaCapacityBytes: 5000,
    });
  });

  it('falls back to zero schema size when the size query fails', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.findByIdWithOwner.mockResolvedValue({
      id: 7,
      schemaName: 'tenant_store',
      owner: null,
    });
    tenantService.getSchemaSizes.mockRejectedValue(new Error('pg down'));

    const result = await service.getTenant(7);

    expect(result.schemaSizeBytes).toBe(0);
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
