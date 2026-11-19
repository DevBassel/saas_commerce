import { Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { TenantManagerService } from '../../services/tenant-manager.service';
import { TenantMigrationService } from '../../services/tenant-migration.service';

const buildMocks = () => {
  const connect = jest.fn().mockResolvedValue(undefined);
  const query = jest.fn().mockResolvedValue(undefined);
  const release = jest.fn().mockResolvedValue(undefined);
  const lockRunner = {
    connect,
    query,
    release,
    isReleased: false,
  } as unknown as QueryRunner;

  const initialize = jest.fn().mockImplementation(function (this: {
    isInitialized: boolean;
  }) {
    this.isInitialized = true;
    return Promise.resolve(this);
  });
  const runMigrations = jest
    .fn()
    .mockResolvedValue([{ name: 'InitialTenant1795099463316' }]);
  const destroy = jest.fn().mockImplementation(function (this: {
    isInitialized: boolean;
  }) {
    this.isInitialized = false;
    return Promise.resolve();
  });
  const migrationDataSource = {
    isInitialized: false,
    initialize,
    runMigrations,
    destroy,
  } as unknown as DataSource;

  const managerRelease = jest.fn().mockResolvedValue(undefined);
  const createMigrationDataSource = jest.fn(() => migrationDataSource);
  const manager = {
    release: managerRelease,
    createMigrationDataSource,
  } as unknown as TenantManagerService;
  const platformDataSource = {
    createQueryRunner: jest.fn(() => lockRunner),
  } as unknown as DataSource;

  return {
    service: new TenantMigrationService(manager, platformDataSource),
    lockRunner,
    migrationDataSource,
    manager,
    query,
    release,
    runMigrations,
    destroy,
    managerRelease,
    createMigrationDataSource,
  };
};

describe('TenantMigrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a tenant schema idempotently without running migrations', async () => {
    const { service, query, runMigrations, managerRelease } = buildMocks();

    await service.ensureSchema('tenant_acme');

    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      ['saas-commerce:tenant-migrations:tenant_acme'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'CREATE SCHEMA IF NOT EXISTS "tenant_acme"',
    );
    expect(managerRelease).toHaveBeenCalledWith({ schemaName: 'tenant_acme' });
    expect(runMigrations).not.toHaveBeenCalled();
  });

  it('locks, creates the schema and executes pending migrations safely', async () => {
    const { service, query, release, runMigrations, destroy, managerRelease } =
      buildMocks();

    await expect(service.migrate('tenant_acme')).resolves.toEqual({
      schemaName: 'tenant_acme',
      executedMigrations: ['InitialTenant1795099463316'],
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      ['saas-commerce:tenant-migrations:tenant_acme'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'CREATE SCHEMA IF NOT EXISTS "tenant_acme"',
    );
    expect(managerRelease).toHaveBeenCalledWith({ schemaName: 'tenant_acme' });
    expect(runMigrations).toHaveBeenCalledWith({
      transaction: 'each',
    });
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent migration requests for the same tenant', async () => {
    const { service, runMigrations, createMigrationDataSource } = buildMocks();
    let finish!: (value: Array<{ name: string }>) => void;
    runMigrations.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    const first = service.migrate('tenant_acme');
    const second = service.migrate('tenant_acme');

    expect(second).toBe(first);
    await Promise.resolve();
    finish([]);
    await Promise.all([first, second]);
    expect(createMigrationDataSource).toHaveBeenCalledTimes(1);
  });

  it('destroys the migration datasource and leaves the error visible', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service, runMigrations, destroy } = buildMocks();
    runMigrations.mockRejectedValue(new Error('broken migration'));

    await expect(service.migrate('tenant_acme')).rejects.toThrow(
      'broken migration',
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects schemas outside the tenant namespace before connecting', () => {
    const { service, createMigrationDataSource } = buildMocks();

    expect(() => service.migrate('public')).toThrow(
      'Invalid tenant schema name',
    );
    expect(createMigrationDataSource).not.toHaveBeenCalled();
  });
});
