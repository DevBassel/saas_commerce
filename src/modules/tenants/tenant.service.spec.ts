import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';
import { TenantManagerService } from './tenant-manager.service';
import { IENV } from 'src/common/config/env.interface';

const buildMocks = () => {
  const manager = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const transaction = jest.fn((callback: (m: unknown) => unknown) =>
    callback(manager),
  );
  const tenantRepo = {
    manager: { transaction },
  } as unknown as Repository<Tenant>;

  const service = new TenantService(
    tenantRepo,
    {} as TenantManagerService,
    {} as DataSource,
    {} as ConfigService<IENV>,
  );

  return { service, tenantRepo, manager, transaction };
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
