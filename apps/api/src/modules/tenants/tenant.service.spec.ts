import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';
import { TenantStatus } from './enums/tenantStatus.enum';
import { TenantManagerService } from './services/tenant-manager.service';
import { User } from '../users/entities/user.entity';
import { IENV } from 'src/common/config/env.interface';

const buildMocks = () => {
  const manager = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const transaction = jest.fn((callback: (m: unknown) => unknown) =>
    callback(manager),
  );
  const tenantRepoMocks = {
    findOneBy: jest.fn(),
    update: jest.fn(),
    save: jest.fn((data: unknown) => data),
    create: jest.fn((data: unknown) => data),
    find: jest.fn(),
  };
  const tenantRepo = {
    ...tenantRepoMocks,
    manager: { transaction },
  } as unknown as Repository<Tenant>;

  const ownerRepo = {
    findOne: jest.fn(),
  };
  const tenantManagerMocks = {
    release: jest.fn().mockResolvedValue(undefined),
    getRepository: jest.fn(() => Promise.resolve(ownerRepo)),
  };
  const tenantManager = tenantManagerMocks as unknown as TenantManagerService;

  const dataSourceMocks = {
    query: jest.fn(),
  };
  const dataSource = dataSourceMocks as unknown as DataSource;

  const configMocks = {
    getOrThrow: jest.fn((key: string) =>
      key === 'db' ? { tenantStorageCapacityBytes: 1000 } : undefined,
    ),
  };
  const config = configMocks as unknown as ConfigService<IENV>;

  const service = new TenantService(
    tenantRepo,
    tenantManager,
    dataSource,
    config,
  );

  return {
    service,
    tenantRepo,
    tenantRepoMocks,
    manager,
    transaction,
    tenantManagerMocks,
    ownerRepo,
    dataSourceMocks,
    configMocks,
  };
};

const tenantRow = (overrides: Partial<Tenant> = {}): Tenant =>
  ({
    id: 1,
    schemaName: 'tenant_test',
    storageUsedBytes: 100n,
    storageCapacityBytes: 1000n,
    ...overrides,
  }) as Tenant;

describe('TenantService.adjustStorageUsedBytes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies a signed delta under a row lock and returns the new usage', async () => {
    const { service, manager, transaction } = buildMocks();
    manager.findOne.mockResolvedValue(tenantRow());
    manager.update.mockResolvedValue({ affected: 1 });

    const result = await service.adjustStorageUsedBytes('tenant_test', 50);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(manager.findOne).toHaveBeenCalledWith(Tenant, {
      where: { schemaName: 'tenant_test' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.update).toHaveBeenCalledTimes(1);
    expect(manager.update).toHaveBeenCalledWith(
      Tenant,
      { id: 1 },
      { storageUsedBytes: 150n },
    );
    expect(result).toBe(150);
  });

  it('decrements usage when given a negative delta', async () => {
    const { service, manager } = buildMocks();
    manager.findOne.mockResolvedValue(tenantRow());
    manager.update.mockResolvedValue({ affected: 1 });

    const result = await service.adjustStorageUsedBytes('tenant_test', -40);

    expect(manager.update).toHaveBeenCalledWith(
      Tenant,
      { id: 1 },
      { storageUsedBytes: 60n },
    );
    expect(result).toBe(60);
  });

  it('throws NotFoundException when the schema does not exist', async () => {
    const { service, manager } = buildMocks();
    manager.findOne.mockResolvedValue(null);

    await expect(
      service.adjustStorageUsedBytes('tenant_missing', 10),
    ).rejects.toThrow(NotFoundException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('rejects a positive delta that exceeds capacity without writing', async () => {
    const { service, manager } = buildMocks();
    manager.findOne.mockResolvedValue(tenantRow());

    await expect(
      service.adjustStorageUsedBytes('tenant_test', 901),
    ).rejects.toThrow(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('clamps a negative delta below zero and warns', async () => {
    const { service, manager } = buildMocks();
    manager.findOne.mockResolvedValue(tenantRow({ storageUsedBytes: 10n }));
    manager.update.mockResolvedValue({ affected: 1 });
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const result = await service.adjustStorageUsedBytes('tenant_test', -25);

    expect(manager.update).toHaveBeenCalledWith(
      Tenant,
      { id: 1 },
      { storageUsedBytes: 0n },
    );
    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1.5, Number.NaN])(
    'rejects invalid delta %p before opening a transaction',
    async (delta) => {
      const { service, transaction } = buildMocks();

      await expect(
        service.adjustStorageUsedBytes('tenant_test', delta),
      ).rejects.toThrow(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});

describe('TenantService Stripe Connect state', () => {
  it('finds a tenant by its Stripe account id', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    const row = tenantRow({ stripeAccountId: 'acct_123' });
    tenantRepoMocks.findOneBy.mockResolvedValue(row);

    const result = await service.findByStripeAccountId('acct_123');

    expect(tenantRepoMocks.findOneBy).toHaveBeenCalledWith({
      stripeAccountId: 'acct_123',
    });
    expect(result).toBe(row);
  });

  it('returns null when no tenant owns the Stripe account id', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    tenantRepoMocks.findOneBy.mockResolvedValue(null);

    await expect(
      service.findByStripeAccountId('acct_missing'),
    ).resolves.toBeNull();
  });

  it('updates the Connect flags for a tenant', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    tenantRepoMocks.update.mockResolvedValue({ affected: 1 });

    await service.updateStripeAccountState(1, {
      stripeAccountId: 'acct_123',
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
    });

    expect(tenantRepoMocks.update).toHaveBeenCalledWith(
      { id: 1 },
      {
        stripeAccountId: 'acct_123',
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
      },
    );
  });
});

describe('TenantService.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the schema name from the slug', async () => {
    const { service, tenantRepoMocks } = buildMocks();

    await service.create({ name: 'My Store', slug: 'My-Shop' });

    expect(tenantRepoMocks.findOneBy).toHaveBeenCalledWith({
      schemaName: 'tenant_my_shop',
    });
    expect(tenantRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Store',
        slug: 'My-Shop',
        schemaName: 'tenant_my_shop',
      }),
    );
    expect(tenantRepoMocks.save).toHaveBeenCalledTimes(1);
  });

  it('defaults the subdomain to the slug', async () => {
    const { service, tenantRepoMocks } = buildMocks();

    await service.create({ name: 'My Store', slug: 'my-shop' });

    expect(tenantRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ subdomain: 'my-shop' }),
    );
  });

  it('keeps an explicit subdomain when provided', async () => {
    const { service, tenantRepoMocks } = buildMocks();

    await service.create({
      name: 'My Store',
      slug: 'my-shop',
      subdomain: 'shop',
    });

    expect(tenantRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ subdomain: 'shop' }),
    );
  });

  it('conflicts when the schema name already exists and writes nothing', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    tenantRepoMocks.findOneBy.mockResolvedValue(tenantRow());

    await expect(
      service.create({ name: 'My Store', slug: 'test' }),
    ).rejects.toThrow(ConflictException);
    expect(tenantRepoMocks.create).not.toHaveBeenCalled();
    expect(tenantRepoMocks.save).not.toHaveBeenCalled();
  });

  it('warns when the generated schema name reaches the 63-char limit', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.create({ name: 'My Store', slug: 'a'.repeat(56) });

    const [[created]] = tenantRepoMocks.create.mock.calls as unknown as Array<
      [{ schemaName: string }]
    >;
    expect(created.schemaName).toHaveLength(63);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('stores the configured tenant storage capacity as bigint', async () => {
    const { service, tenantRepoMocks, configMocks } = buildMocks();
    configMocks.getOrThrow.mockReturnValue({
      tenantStorageCapacityBytes: 2048,
    });

    await service.create({ name: 'My Store', slug: 'my-shop' });

    expect(configMocks.getOrThrow).toHaveBeenCalledWith('db');
    expect(tenantRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ storageCapacityBytes: 2048n }),
    );
  });
});

describe('TenantService.toggleActiveTenant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deactivates an active tenant and releases its datasource', async () => {
    const { service, tenantRepoMocks, tenantManagerMocks } = buildMocks();
    tenantRepoMocks.findOneBy.mockResolvedValue(
      tenantRow({ id: 7, status: TenantStatus.ACTIVE }),
    );

    const result = await service.toggleActiveTenant(7);

    expect(tenantRepoMocks.update).toHaveBeenCalledWith(7, {
      status: TenantStatus.INACTIVE,
    });
    expect(tenantManagerMocks.release).toHaveBeenCalledWith({
      schemaName: 'tenant_test',
    });
    expect(result).toBe('Tenant deactivated successfully');
  });

  it('reactivates an inactive tenant without releasing the datasource', async () => {
    const { service, tenantRepoMocks, tenantManagerMocks } = buildMocks();
    tenantRepoMocks.findOneBy.mockResolvedValue(
      tenantRow({ id: 7, status: TenantStatus.INACTIVE }),
    );

    const result = await service.toggleActiveTenant(7);

    expect(tenantRepoMocks.update).toHaveBeenCalledWith(7, {
      status: TenantStatus.ACTIVE,
    });
    expect(tenantManagerMocks.release).not.toHaveBeenCalled();
    expect(result).toBe('Tenant activated successfully');
  });

  it('propagates not-found when the tenant does not exist', async () => {
    const { service, tenantRepoMocks, tenantManagerMocks } = buildMocks();
    tenantRepoMocks.findOneBy.mockResolvedValue(null);

    await expect(service.toggleActiveTenant(7)).rejects.toThrow(
      NotFoundException,
    );
    expect(tenantRepoMocks.update).not.toHaveBeenCalled();
    expect(tenantManagerMocks.release).not.toHaveBeenCalled();
  });
});

describe('TenantService.findByIdWithOwner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a null owner without loading a repository when ownerUserId is unset', async () => {
    const { service, tenantRepoMocks, tenantManagerMocks } = buildMocks();
    tenantRepoMocks.findOneBy.mockResolvedValue(
      tenantRow({ id: 7, ownerUserId: null }),
    );

    const result = await service.findByIdWithOwner(7);

    expect(result.owner).toBeNull();
    expect(tenantManagerMocks.getRepository).not.toHaveBeenCalled();
  });

  it('loads the owner from the tenant schema when ownerUserId is set', async () => {
    const { service, tenantRepoMocks, tenantManagerMocks, ownerRepo } =
      buildMocks();
    const tenant = tenantRow({ id: 7, ownerUserId: 42 });
    tenantRepoMocks.findOneBy.mockResolvedValue(tenant);
    const owner = { id: 42, email: 'owner@example.com' };
    ownerRepo.findOne.mockResolvedValue(owner);

    const result = await service.findByIdWithOwner(7);

    expect(tenantManagerMocks.getRepository).toHaveBeenCalledWith(User, tenant);
    expect(ownerRepo.findOne).toHaveBeenCalledWith({
      where: { id: 42 },
      relations: { role: true, permissions: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: { name: true, key: true },
        permissions: { name: true, key: true },
      },
    });
    expect(result.owner).toBe(owner);
  });
});

describe('TenantService.getSchemaSizes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('short-circuits without querying when given no schemas', async () => {
    const { service, dataSourceMocks } = buildMocks();

    const result = await service.getSchemaSizes([]);

    expect(result.size).toBe(0);
    expect(dataSourceMocks.query).not.toHaveBeenCalled();
  });

  it('maps bigint string sizes to numbers keyed by schema name', async () => {
    const { service, dataSourceMocks } = buildMocks();
    dataSourceMocks.query.mockResolvedValue([
      { schema_name: 'tenant_a', size_bytes: '123' },
      { schema_name: 'tenant_b', size_bytes: '9007199254740991' },
    ]);

    const result = await service.getSchemaSizes(['tenant_a', 'tenant_b']);

    expect(typeof result.get('tenant_a')).toBe('number');
    expect(result.get('tenant_a')).toBe(123);
    expect(result.get('tenant_b')).toBe(9007199254740991);
    expect(dataSourceMocks.query).toHaveBeenCalledWith(expect.any(String), [
      ['tenant_a', 'tenant_b'],
    ]);
  });
});

describe('TenantService finders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findBySlug delegates to findOneBy', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    const row = tenantRow();
    tenantRepoMocks.findOneBy.mockResolvedValue(row);

    await expect(service.findBySlug('my-shop')).resolves.toBe(row);
    expect(tenantRepoMocks.findOneBy).toHaveBeenCalledWith({ slug: 'my-shop' });
  });

  it('findBySchemaName delegates to findOneBy', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    const row = tenantRow();
    tenantRepoMocks.findOneBy.mockResolvedValue(row);

    await expect(service.findBySchemaName('tenant_test')).resolves.toBe(row);
    expect(tenantRepoMocks.findOneBy).toHaveBeenCalledWith({
      schemaName: 'tenant_test',
    });
  });

  it('findBySubdomain delegates to findOneBy', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    const row = tenantRow({ subdomain: 'shop' });
    tenantRepoMocks.findOneBy.mockResolvedValue(row);

    await expect(service.findBySubdomain('shop')).resolves.toBe(row);
    expect(tenantRepoMocks.findOneBy).toHaveBeenCalledWith({
      subdomain: 'shop',
    });
  });

  it('findByStripeAccountId delegates to findOneBy', async () => {
    const { service, tenantRepoMocks } = buildMocks();
    const row = tenantRow({ stripeAccountId: 'acct_123' });
    tenantRepoMocks.findOneBy.mockResolvedValue(row);

    await expect(service.findByStripeAccountId('acct_123')).resolves.toBe(row);
    expect(tenantRepoMocks.findOneBy).toHaveBeenCalledWith({
      stripeAccountId: 'acct_123',
    });
  });
});
